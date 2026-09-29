// Main-thread side of the in-browser runtimes. Client-only: import dynamically.
//
// Each runtime lives in a dedicated Web Worker. A watchdog terminates the
// worker when user code runs past its budget (infinite loops can't be
// interrupted any other way), and the worker is recreated on the next job.

import { buildBatchProgram, parseBatchOutput, remapUserLines, spliceUserCode } from "../batch";
import type { JudgeLang, LangKey } from "../languages";
import type { BatchRunResult, RunResult } from "../types";

type WorkerKind = "js" | "py";

type Chunk = { stream: "out" | "err"; text: string };

type Outcome = {
  stdout: string;
  stderr: string;
  timedOut: boolean;
  exitCode: number | null;
  fatal: string | null;
  elapsedMs: number;
};

type Job = {
  id: number;
  payload: Record<string, unknown>;
  budgetMs: number;
  resolve: (o: Outcome) => void;
  onChunk?: (c: Chunk) => void;
};

const BROWSER_LANGS = new Set<LangKey>(["python", "javascript", "typescript"]);

export function canRunInBrowser(lang: LangKey): boolean {
  return typeof Worker !== "undefined" && BROWSER_LANGS.has(lang);
}

class WorkerHost {
  private worker: Worker | null = null;
  private queue: Job[] = [];
  private active: Job | null = null;
  private seq = 0;
  private buffers = { out: "", err: "" };
  private exitCode: number | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  ready = false;

  constructor(private readonly kind: WorkerKind) {}

  private spawn(): Worker {
    const w =
      this.kind === "py"
        ? new Worker(new URL("./py.worker.ts", import.meta.url), { type: "module" })
        : new Worker(new URL("./js.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent) => this.onMessage(e.data);
    w.onerror = (e) => {
      e.preventDefault();
      this.finish({ fatal: e.message || "The runtime crashed." });
    };
    return w;
  }

  run(payload: Record<string, unknown>, budgetMs: number, onChunk?: (c: Chunk) => void) {
    return new Promise<Outcome>((resolve) => {
      this.queue.push({ id: ++this.seq, payload, budgetMs, resolve, onChunk });
      this.pump();
    });
  }

  private pump() {
    if (this.active || !this.queue.length) return;
    const job = this.queue.shift()!;
    this.active = job;
    this.buffers = { out: "", err: "" };
    this.exitCode = null;
    this.startedAt = 0;
    if (!this.worker) this.worker = this.spawn();
    this.worker.postMessage({ id: job.id, ...job.payload });
  }

  private arm() {
    if (!this.active) return;
    if (this.watchdog) clearTimeout(this.watchdog);
    this.startedAt = performance.now();
    this.watchdog = setTimeout(() => {
      this.worker?.terminate();
      this.worker = null;
      this.ready = false;
      this.finish({ timedOut: true });
    }, this.active.budgetMs);
  }

  private onMessage(msg: {
    id: number;
    type: string;
    stream?: "out" | "err";
    text?: string;
    code?: number;
    error?: string;
  }) {
    const job = this.active;
    if (!job || msg.id !== job.id) return;
    switch (msg.type) {
      case "started":
        this.ready = true;
        this.arm();
        break;
      case "chunk":
        if (msg.stream && msg.text) {
          this.buffers[msg.stream] += msg.text;
          job.onChunk?.({ stream: msg.stream, text: msg.text });
        }
        break;
      case "exit":
        this.exitCode = msg.code ?? null;
        break;
      case "fatal":
        this.finish({ fatal: msg.error ?? "Runtime failed to start." });
        break;
      case "done":
        this.ready = true;
        this.finish({});
        break;
    }
  }

  private finish(extra: { timedOut?: boolean; fatal?: string }) {
    const job = this.active;
    if (!job) return;
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
    this.active = null;
    job.resolve({
      stdout: this.buffers.out,
      stderr: this.buffers.err,
      timedOut: !!extra.timedOut,
      exitCode: this.exitCode,
      fatal: extra.fatal ?? null,
      elapsedMs: this.startedAt ? performance.now() - this.startedAt : 0,
    });
    this.pump();
  }
}

const hosts: Partial<Record<WorkerKind, WorkerHost>> = {};
function host(kind: WorkerKind): WorkerHost {
  return (hosts[kind] ??= new WorkerHost(kind));
}

function kindFor(lang: LangKey): WorkerKind {
  return lang === "python" ? "py" : "js";
}

/** Start downloading / booting a runtime ahead of the first Run. */
export function preloadBrowserRuntime(lang: LangKey): void {
  if (!canRunInBrowser(lang) || lang !== "python") return;
  const h = host("py");
  if (!h.ready) void h.run({ warmup: true }, 120_000);
}

export function isRuntimeReady(lang: LangKey): boolean {
  return lang !== "python" || !!hosts.py?.ready;
}

function makeNonce(): string {
  return Math.random().toString(16).slice(2, 10) + Date.now().toString(16);
}

/** Strip the protocol markers from a single-run stream. */
function stripMarkers(text: string, nonce: string): string {
  return text
    .replace(new RegExp(`@@EZ:${nonce}:B:\\d+\\n`, "g"), "")
    .replace(new RegExp(`\\n?@@EZ:${nonce}:E:\\d+(?::\\w+:[\\d.]+:\\d+)?\\n?`, "g"), "")
    .replace(new RegExp(`@@EZ:${nonce}:C\\n`, "g"), "");
}

/** Run a whole program once with stdin (compiler / playground "Run"). */
export async function browserExecute(opts: {
  language: LangKey;
  source: string;
  stdin: string;
  timeoutMs?: number;
  onChunk?: (c: Chunk) => void;
}): Promise<RunResult> {
  const budget = opts.timeoutMs ?? 10_000;
  const base: RunResult = {
    ok: false,
    stdout: "",
    stderr: "",
    compileOutput: "",
    output: "",
    exitCode: null,
    signal: null,
    timedOut: false,
    error: null,
    timeMs: null,
    memoryKb: null,
    engine: "browser",
  };

  if (opts.language === "python") {
    const o = await host("py").run(
      { source: opts.source, stdin: opts.stdin },
      budget,
      opts.onChunk,
    );
    if (o.fatal) return { ...base, error: o.fatal };
    const compileFailed =
      o.exitCode === 1 &&
      /^\s*File "main\.py", line \d+[\s\S]*SyntaxError/m.test(o.stderr) &&
      !o.stdout;
    return {
      ...base,
      ok: !o.timedOut && (o.exitCode ?? 0) === 0,
      stdout: o.stdout,
      stderr: compileFailed ? "" : o.stderr,
      compileOutput: compileFailed ? o.stderr : "",
      output: o.stdout + o.stderr,
      exitCode: o.exitCode,
      timedOut: o.timedOut,
      timeMs: Math.round(o.elapsedMs),
    };
  }

  const nonce = makeNonce();
  const o = await host("js").run(
    {
      language: opts.language === "typescript" ? "typescript" : "javascript",
      source: opts.source,
      inputs: [opts.stdin],
      nonce,
      timeLimitMs: budget,
    },
    budget,
    opts.onChunk,
  );
  if (o.fatal) return { ...base, error: o.fatal };
  const compileFailed = o.stdout.includes(`@@EZ:${nonce}:C`);
  const status = /@@EZ:[^:]+:E:0:(\w+):/.exec(o.stdout)?.[1];
  const stdout = stripMarkers(o.stdout, nonce);
  const stderr = stripMarkers(o.stderr, nonce).replace(/\n$/, "");
  return {
    ...base,
    ok: !compileFailed && !o.timedOut && status === "ok",
    stdout: compileFailed ? "" : stdout,
    stderr: compileFailed ? "" : stderr,
    compileOutput: compileFailed ? stderr : "",
    output: stdout + stderr,
    exitCode: status === "ok" ? 0 : 1,
    timedOut: o.timedOut,
    timeMs: Math.round(o.elapsedMs),
  };
}

/** Run a harness against many inputs inside the browser (Python / JavaScript). */
export async function browserRunBatch(opts: {
  language: JudgeLang;
  harness: string;
  userCode: string;
  inputs: string[];
  timeLimitMs?: number;
}): Promise<BatchRunResult> {
  const { language, inputs } = opts;
  const tl = opts.timeLimitMs ?? 4000;
  const budget = tl * Math.max(1, inputs.length) + 2000;

  if (language === "python") {
    const program = buildBatchProgram("python", opts.harness, opts.userCode, inputs, {
      timeLimitMs: tl,
    });
    if (!program)
      return { compileError: null, cases: [], engine: "browser", error: "Unsupported harness" };
    const o = await host("py").run({ source: program.source, stdin: program.stdin }, budget);
    if (o.fatal) return { compileError: null, cases: [], engine: "browser", error: o.fatal };
    const parsed = parseBatchOutput(program, inputs.length, o.stdout, o.stderr, o.timedOut);
    const remap = (t: string) => remapUserLines(t, program.userLineOffset, program.userLineCount);
    return {
      compileError: parsed.syntaxError ? remap(o.stderr.replace(/@@EZ:[^\n]*\n?/g, "")) : null,
      cases: parsed.cases.map((c) => ({ ...c, stderr: remap(c.stderr) })),
      engine: "browser",
      error: null,
    };
  }

  if (language === "javascript") {
    const nonce = makeNonce();
    const source = spliceUserCode(opts.harness, opts.userCode);
    const offset =
      opts.harness.slice(0, opts.harness.indexOf("__USER_CODE__")).split("\n").length - 1;
    const userLines = opts.userCode.split("\n").length;
    const o = await host("js").run(
      { language: "javascript", source, inputs, nonce, timeLimitMs: tl },
      budget,
    );
    if (o.fatal) return { compileError: null, cases: [], engine: "browser", error: o.fatal };
    const parsed = parseBatchOutput({ nonce }, inputs.length, o.stdout, o.stderr, o.timedOut);
    const remap = (t: string) => remapUserLines(t, offset, userLines);
    return {
      compileError: parsed.syntaxError ? remap(o.stderr.replace(/@@EZ:[^\n]*\n?/g, "")) : null,
      cases: parsed.cases.map((c) => ({ ...c, stderr: remap(c.stderr) })),
      engine: "browser",
      error: null,
    };
  }

  return {
    compileError: null,
    cases: [],
    engine: "browser",
    error: `${language} can't run in the browser`,
  };
}
