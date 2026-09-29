// Server-side code execution with automatic failover.
//
// Free, key-less engines (always available):
//   - Wandbox  (wandbox.org)   — generous time limits, single request, many languages.
//   - Paiza.io (api.paiza.io)  — reports time + memory, ~2s wall-clock limit.
// Optional engines, used first when configured (no shared rate limits):
//   - Piston   PISTON_URL=https://your-host/api/v2   [PISTON_KEY]
//   - Judge0   JUDGE0_URL=https://your-host          [JUDGE0_KEY, JUDGE0_HOST for RapidAPI]
//
// Order can be overridden with RUNNER_ORDER="piston,wandbox,paiza".

import type { LangKey } from "./languages";
import type { RunRequest, RunResult } from "./types";

type Runner = {
  id: string;
  supports: (lang: LangKey) => boolean;
  run: (req: Required<Pick<RunRequest, "language" | "source">> & RunRequest) => Promise<RunResult>;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function emptyResult(error: string | null = null, engine?: string): RunResult {
  return {
    ok: false,
    stdout: "",
    stderr: "",
    compileOutput: "",
    output: "",
    exitCode: null,
    signal: null,
    timedOut: false,
    error,
    timeMs: null,
    memoryKb: null,
    engine,
  };
}

/** Errors that mean "this engine is unavailable", so the next one should be tried. */
class InfraError extends Error {}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new InfraError(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new InfraError(`Invalid JSON from runner: ${text.slice(0, 120)}`);
    }
  } catch (e) {
    if (e instanceof InfraError) throw e;
    throw new InfraError(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

/** Wandbox and some others want a non-public entry class for single-file Java. */
function javaNonPublicMain(source: string): string {
  return source.replace(/\bpublic\s+(final\s+)?class\s+Main\b/, "class Main");
}

/* ----------------------------------------------------------------- Wandbox */

const WANDBOX = "https://wandbox.org/api";

const WANDBOX_PATTERNS: Partial<Record<LangKey, { language: string; prefer: RegExp }>> = {
  python: { language: "Python", prefer: /^cpython-3\.\d+\.\d+$/ },
  javascript: { language: "JavaScript", prefer: /^nodejs-\d+/ },
  typescript: { language: "TypeScript", prefer: /^typescript-/ },
  cpp: { language: "C++", prefer: /^gcc-\d+\.\d+\.\d+$/ },
  c: { language: "C", prefer: /^gcc-\d+\.\d+\.\d+-c$/ },
  java: { language: "Java", prefer: /^openjdk-/ },
  go: { language: "Go", prefer: /^go-/ },
  rust: { language: "Rust", prefer: /^rust-/ },
  csharp: { language: "C#", prefer: /^dotnetcore-/ },
  ruby: { language: "Ruby", prefer: /^ruby-\d/ },
  swift: { language: "Swift", prefer: /^swift-/ },
  php: { language: "PHP", prefer: /^php-\d/ },
};

const WANDBOX_FALLBACK: Partial<Record<LangKey, string>> = {
  python: "cpython-3.13.8",
  javascript: "nodejs-20.17.0",
  typescript: "typescript-5.6.2",
  cpp: "gcc-13.2.0",
  c: "gcc-13.2.0-c",
  java: "openjdk-jdk-22+36",
  go: "go-1.23.2",
  rust: "rust-1.82.0",
  csharp: "dotnetcore-8.0.402",
  ruby: "ruby-3.4.9",
  swift: "swift-6.0.1",
  php: "php-8.3.12",
};

const WANDBOX_OPTIONS: Partial<Record<LangKey, string>> = {
  cpp: "-std=gnu++17\n-O2",
  c: "-std=gnu11\n-O2\n-lm",
  rust: "-O",
};

let wandboxCompilers: { at: number; map: Partial<Record<LangKey, string>> } | null = null;

function versionKey(name: string): number[] {
  return (name.match(/\d+/g) ?? []).map(Number);
}

async function wandboxCompiler(lang: LangKey): Promise<string | undefined> {
  const fresh = wandboxCompilers && Date.now() - wandboxCompilers.at < 12 * 3600_000;
  if (!fresh) {
    try {
      const list = await fetchJson<{ name: string; language: string }[]>(
        `${WANDBOX}/list.json`,
        { method: "GET" },
        8000,
      );
      const map: Partial<Record<LangKey, string>> = {};
      for (const [key, pat] of Object.entries(WANDBOX_PATTERNS) as [
        LangKey,
        { language: string; prefer: RegExp },
      ][]) {
        const candidates = list
          .filter((c) => c.language === pat.language && pat.prefer.test(c.name))
          .map((c) => c.name)
          .sort((a, b) => {
            const va = versionKey(a);
            const vb = versionKey(b);
            for (let i = 0; i < Math.max(va.length, vb.length); i++) {
              const d = (vb[i] ?? 0) - (va[i] ?? 0);
              if (d) return d;
            }
            return 0;
          });
        if (candidates[0]) map[key] = candidates[0];
      }
      wandboxCompilers = { at: Date.now(), map };
    } catch {
      wandboxCompilers = { at: Date.now() - 11 * 3600_000, map: {} };
    }
  }
  return wandboxCompilers?.map[lang] ?? WANDBOX_FALLBACK[lang];
}

type WandboxResponse = {
  status?: string;
  signal?: string;
  compiler_error?: string;
  compiler_output?: string;
  program_output?: string;
  program_error?: string;
};

const wandbox: Runner = {
  id: "wandbox",
  supports: (lang) => lang in WANDBOX_FALLBACK,
  async run(req) {
    const compiler = await wandboxCompiler(req.language);
    if (!compiler) return emptyResult(`Unsupported language: ${req.language}`, "wandbox");
    const source = req.language === "java" ? javaNonPublicMain(req.source) : req.source;
    const started = Date.now();
    const d = await fetchJson<WandboxResponse>(
      `${WANDBOX}/compile.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compiler,
          code: source,
          stdin: req.stdin ?? "",
          "compiler-option-raw": WANDBOX_OPTIONS[req.language] ?? "",
          save: false,
        }),
      },
      (req.timeoutMs ?? 30000) + 15000,
    );
    const wall = Date.now() - started;
    const programOut = d.program_output ?? "";
    const programErr = d.program_error ?? "";
    const compilerErr = d.compiler_error ?? "";
    const exit = d.status != null && d.status !== "" ? Number(d.status) : null;
    const compileFailed = !programOut && !programErr && exit !== 0 && /error/i.test(compilerErr);
    const signal = d.signal || null;
    const timedOut = signal === "Killed" || signal === "SIGKILL" || signal === "SIGXCPU";
    return {
      ok: !compileFailed && exit === 0 && !signal,
      stdout: programOut,
      stderr: programErr,
      compileOutput: compileFailed ? compilerErr : "",
      output: programOut + programErr,
      exitCode: Number.isNaN(exit as number) ? null : exit,
      signal,
      timedOut,
      error: null,
      timeMs: wall,
      memoryKb: null,
      engine: "wandbox",
    };
  },
};

/* ------------------------------------------------------------------- Paiza */

const PAIZA = "https://api.paiza.io/runners";
const PAIZA_LANG: Partial<Record<LangKey, string>> = {
  python: "python3",
  javascript: "javascript",
  typescript: "typescript",
  cpp: "cpp",
  c: "c",
  java: "java",
  go: "go",
  rust: "rust",
  csharp: "csharp",
  kotlin: "kotlin",
  ruby: "ruby",
  swift: "swift",
  php: "php",
};
const PAIZA_KEY = "guest";

const paiza: Runner = {
  id: "paiza",
  supports: (lang) => lang in PAIZA_LANG,
  async run(req) {
    const language = PAIZA_LANG[req.language];
    if (!language) return emptyResult(`Unsupported language: ${req.language}`, "paiza");
    const created = await fetchJson<{ id?: string; error?: string }>(
      `${PAIZA}/create`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          source_code: req.source,
          language,
          input: req.stdin ?? "",
          api_key: PAIZA_KEY,
        }).toString(),
      },
      15000,
    );
    if (!created.id) throw new InfraError(created.error || "Paiza did not start the run");

    const deadline = Date.now() + (req.timeoutMs ?? 25000) + 10000;
    let wait = 300;
    let done = false;
    while (Date.now() < deadline) {
      await sleep(wait);
      wait = Math.min(wait + 200, 1000);
      const s = await fetchJson<{ status?: string }>(
        `${PAIZA}/get_status?id=${created.id}&api_key=${PAIZA_KEY}`,
        { method: "GET" },
        8000,
      ).catch(() => null);
      if (s?.status === "completed") {
        done = true;
        break;
      }
    }
    if (!done) throw new InfraError("Paiza did not finish in time");

    const d = await fetchJson<{
      stdout?: string | null;
      stderr?: string | null;
      build_stderr?: string | null;
      build_result?: string | null;
      exit_code?: string | null;
      result?: string | null;
      time?: string | null;
      memory?: string | null;
    }>(`${PAIZA}/get_details?id=${created.id}&api_key=${PAIZA_KEY}`, { method: "GET" }, 10000);

    const buildFailed = !!d.build_result && d.build_result !== "success";
    const exit = d.exit_code != null ? parseInt(d.exit_code, 10) : null;
    const secs = d.time != null ? parseFloat(d.time) : NaN;
    const mem = d.memory != null ? parseInt(d.memory, 10) : NaN;
    return {
      ok: d.result === "success" && !buildFailed,
      stdout: d.stdout ?? "",
      stderr: d.stderr ?? "",
      compileOutput: buildFailed ? (d.build_stderr ?? "Compilation failed.") : "",
      output: (d.stdout ?? "") + (d.stderr ?? ""),
      exitCode: exit != null && !Number.isNaN(exit) ? exit : null,
      signal: null,
      timedOut: d.result === "timeout",
      error: null,
      timeMs: Number.isNaN(secs) ? null : Math.round(secs * 1000),
      memoryKb: Number.isNaN(mem) ? null : Math.round(mem / 1024),
      engine: "paiza",
    };
  },
};

/* ------------------------------------------------------------ Piston (opt) */

const PISTON_LANG: Partial<Record<LangKey, string>> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  cpp: "c++",
  c: "c",
  java: "java",
  go: "go",
  rust: "rust",
  csharp: "csharp",
  kotlin: "kotlin",
  ruby: "ruby",
  swift: "swift",
  php: "php",
};

const piston: Runner = {
  id: "piston",
  supports: (lang) => !!process.env.PISTON_URL && lang in PISTON_LANG,
  async run(req) {
    const base = process.env.PISTON_URL!.replace(/\/$/, "");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.PISTON_KEY) headers.Authorization = process.env.PISTON_KEY;
    const started = Date.now();
    const d = await fetchJson<{
      compile?: { stderr?: string; code?: number };
      run?: { stdout?: string; stderr?: string; code?: number | null; signal?: string | null };
      message?: string;
    }>(
      `${base}/execute`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          language: PISTON_LANG[req.language],
          version: "*",
          files: [{ name: req.language === "java" ? "Main.java" : undefined, content: req.source }],
          stdin: req.stdin ?? "",
          run_timeout: Math.min(req.timeoutMs ?? 15000, 60000),
        }),
      },
      (req.timeoutMs ?? 15000) + 15000,
    );
    if (!d.run && d.message) throw new InfraError(d.message);
    const compileFailed = !!d.compile && d.compile.code !== 0 && !!d.compile.stderr;
    const signal = d.run?.signal ?? null;
    return {
      ok: !compileFailed && d.run?.code === 0,
      stdout: d.run?.stdout ?? "",
      stderr: d.run?.stderr ?? "",
      compileOutput: compileFailed ? (d.compile?.stderr ?? "") : "",
      output: (d.run?.stdout ?? "") + (d.run?.stderr ?? ""),
      exitCode: d.run?.code ?? null,
      signal,
      timedOut: signal === "SIGKILL",
      error: null,
      timeMs: Date.now() - started,
      memoryKb: null,
      engine: "piston",
    };
  },
};

/* ------------------------------------------------------------ Judge0 (opt) */

const JUDGE0_LANG: Partial<Record<LangKey, number>> = {
  python: 71,
  javascript: 63,
  typescript: 74,
  cpp: 54,
  c: 50,
  java: 62,
  go: 60,
  rust: 73,
  csharp: 51,
  kotlin: 78,
  ruby: 72,
  swift: 83,
  php: 68,
};

const judge0: Runner = {
  id: "judge0",
  supports: (lang) => !!process.env.JUDGE0_URL && lang in JUDGE0_LANG,
  async run(req) {
    const base = process.env.JUDGE0_URL!.replace(/\/$/, "");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.JUDGE0_KEY) {
      headers["X-RapidAPI-Key"] = process.env.JUDGE0_KEY;
      headers["X-Auth-Token"] = process.env.JUDGE0_KEY;
    }
    if (process.env.JUDGE0_HOST) headers["X-RapidAPI-Host"] = process.env.JUDGE0_HOST;
    const d = await fetchJson<{
      stdout?: string | null;
      stderr?: string | null;
      compile_output?: string | null;
      status?: { id: number; description: string };
      time?: string | null;
      memory?: number | null;
      exit_code?: number | null;
    }>(
      `${base}/submissions?base64_encoded=false&wait=true`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          language_id: JUDGE0_LANG[req.language],
          source_code: req.source,
          stdin: req.stdin ?? "",
          cpu_time_limit: Math.min((req.timeoutMs ?? 10000) / 1000, 15),
        }),
      },
      (req.timeoutMs ?? 10000) + 20000,
    );
    const statusId = d.status?.id ?? 0;
    if (statusId === 13) throw new InfraError(d.status?.description ?? "Judge0 internal error");
    const compileFailed = statusId === 6;
    const secs = d.time ? parseFloat(d.time) : NaN;
    return {
      ok: statusId === 3,
      stdout: d.stdout ?? "",
      stderr: d.stderr ?? "",
      compileOutput: compileFailed ? (d.compile_output ?? "Compilation failed.") : "",
      output: (d.stdout ?? "") + (d.stderr ?? ""),
      exitCode: d.exit_code ?? null,
      signal: null,
      timedOut: statusId === 5,
      error: null,
      timeMs: Number.isNaN(secs) ? null : Math.round(secs * 1000),
      memoryKb: d.memory ?? null,
      engine: "judge0",
    };
  },
};

/* --------------------------------------------------------------- failover */

const ALL: Record<string, Runner> = { piston, judge0, wandbox, paiza };

/** Engines that recently failed are skipped for a short cool-down. */
const cooldown = new Map<string, number>();

function runnerOrder(): Runner[] {
  const custom = process.env.RUNNER_ORDER?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s in ALL);
  const ids = custom?.length ? custom : ["piston", "judge0", "wandbox", "paiza"];
  return ids.map((id) => ALL[id]);
}

/**
 * Execute code on the first healthy engine that supports the language.
 * Compile errors / wrong output are returned as-is; only infrastructure
 * failures trigger failover to the next engine.
 */
export async function executeRemote(opts: RunRequest): Promise<RunResult> {
  const order = runnerOrder().filter((r) => r.supports(opts.language));
  const now = Date.now();
  const healthy = order.filter((r) => (cooldown.get(r.id) ?? 0) < now);
  const attempt = healthy.length ? healthy : order;
  if (!attempt.length) return emptyResult(`No execution engine supports ${opts.language}.`);

  const errors: string[] = [];
  for (const runner of attempt) {
    try {
      const res = await runner.run({ ...opts, language: opts.language, source: opts.source });
      cooldown.delete(runner.id);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${runner.id}: ${msg}`);
      cooldown.set(runner.id, Date.now() + 30_000);
    }
  }
  console.error("[runner] all engines failed", errors);
  return emptyResult(
    "The code runners are busy right now. Please try again in a few seconds.",
    "none",
  );
}
