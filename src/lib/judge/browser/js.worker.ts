/// <reference lib="webworker" />
// Runs JavaScript / TypeScript inside a Web Worker with a small Node-compatible
// surface (fs.readFileSync(0), readline, process.stdin/stdout, console, Buffer).
// Emits the same marker protocol as the server-side batch driver.

import { transform } from "sucrase";

type Job = {
  id: number;
  language: "javascript" | "typescript";
  source: string;
  inputs: string[];
  nonce: string;
  timeLimitMs: number;
};

declare const self: DedicatedWorkerGlobalScope;

/* ---------------------------------------------------------- formatting */

function inspect(value: unknown, depth = 0, seen = new WeakSet<object>()): string {
  if (typeof value === "string") return depth === 0 ? value : `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === "number") return Object.is(value, -0) ? "-0" : String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return `[Function: ${value.name || "(anonymous)"}]`;
  if (value === null) return "null";
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular *1]";
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      if (depth > 2) return "[Array]";
      return `[ ${value.map((v) => inspect(v, depth + 1, seen)).join(", ")} ]`;
    }
    if (value instanceof Map) {
      const items = [...value].map(([k, v]) => `${inspect(k, depth + 1, seen)} => ${inspect(v, depth + 1, seen)}`);
      return `Map(${value.size}) { ${items.join(", ")} }`;
    }
    if (value instanceof Set) {
      return `Set(${value.size}) { ${[...value].map((v) => inspect(v, depth + 1, seen)).join(", ")} }`;
    }
    if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    if (depth > 2) return "[Object]";
    const key = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
    return `{ ${entries.map(([k, v]) => `${key(k)}: ${inspect(v, depth + 1, seen)}`).join(", ")} }`;
  } finally {
    seen.delete(value);
  }
}

function format(args: unknown[]): string {
  if (args.length === 0) return "";
  let rest = args;
  let head = "";
  if (typeof args[0] === "string" && /%[sdifjoO%]/.test(args[0])) {
    let i = 1;
    head = args[0].replace(/%([sdifjoO%])/g, (m, c: string) => {
      if (c === "%") return "%";
      if (i >= args.length) return m;
      const a = args[i++];
      switch (c) {
        case "s":
          return typeof a === "string" ? a : inspect(a, 1);
        case "d":
        case "i":
          return String(c === "i" ? Math.trunc(Number(a)) : Number(a));
        case "f":
          return String(Number(a));
        case "j":
          return JSON.stringify(a);
        default:
          return inspect(a, 1);
      }
    });
    rest = args.slice(i);
    return [head, ...rest.map((a) => (typeof a === "string" ? a : inspect(a)))].join(" ");
  }
  return rest.map((a) => (typeof a === "string" ? a : inspect(a))).join(" ");
}

/* ------------------------------------------------------------- Node shim */

class MiniBuffer {
  constructor(private readonly text: string) {}
  toString() {
    return this.text;
  }
  get length() {
    return new TextEncoder().encode(this.text).length;
  }
  static from(x: unknown) {
    return new MiniBuffer(typeof x === "string" ? x : String(x));
  }
}

type Listener = (...args: unknown[]) => void;

function createRuntime(input: string, out: string[], err: string[]) {
  const pending: (() => void)[] = [];
  const lines = input.length ? input.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n") : [];

  const stdin = {
    fd: 0,
    isTTY: false,
    listeners: {} as Record<string, Listener[]>,
    setEncoding() {
      return stdin;
    },
    resume() {
      return stdin;
    },
    on(event: string, cb: Listener) {
      (stdin.listeners[event] ??= []).push(cb);
      if (event === "data") pending.push(() => cb(input));
      if (event === "end") pending.push(() => cb());
      return stdin;
    },
    read() {
      return input;
    },
  };

  const readline = {
    createInterface() {
      const handlers: Record<string, Listener[]> = {};
      const rl = {
        on(event: string, cb: Listener) {
          (handlers[event] ??= []).push(cb);
          if (event === "line") pending.push(() => lines.forEach((l) => cb(l)));
          if (event === "close") pending.push(() => cb());
          return rl;
        },
        once(event: string, cb: Listener) {
          return rl.on(event, cb);
        },
        close() {},
        question(_q: string, cb: (answer: string) => void) {
          pending.push(() => cb(lines.shift() ?? ""));
        },
        async *[Symbol.asyncIterator]() {
          for (const l of lines) yield l;
        },
      };
      return rl;
    },
  };

  const fs = {
    readFileSync(p: unknown, o?: unknown) {
      if (p === 0 || p === "/dev/stdin") {
        const enc = typeof o === "string" ? o : (o as { encoding?: string } | undefined)?.encoding;
        return enc ? input : new MiniBuffer(input);
      }
      throw new Error(`ENOENT: no such file or directory, open '${String(p)}'`);
    },
    writeSync(fd: number, s: string) {
      (fd === 2 ? err : out).push(String(s));
    },
  };

  const EXIT = { ezExit: true };
  const util = { format: (...a: unknown[]) => format(a), inspect: (v: unknown) => inspect(v, 1) };

  const require = (m: string) => {
    switch (m.replace(/^node:/, "")) {
      case "fs":
        return fs;
      case "readline":
        return readline;
      case "util":
        return util;
      case "process":
        return proc;
      default:
        throw new Error(`Cannot find module '${m}' (not available in the browser runtime)`);
    }
  };

  const push = (target: string[]) => (...a: unknown[]) => {
    target.push(format(a) + "\n");
  };
  const console = {
    log: push(out),
    info: push(out),
    debug: push(out),
    dir: (v: unknown) => out.push(inspect(v, 1) + "\n"),
    table: push(out),
    error: push(err),
    warn: push(err),
    trace: push(err),
    assert: (cond: unknown, ...a: unknown[]) => {
      if (!cond) err.push(`Assertion failed${a.length ? `: ${format(a)}` : ""}\n`);
    },
  };

  const proc = {
    argv: ["node", "main.js"],
    env: {},
    platform: "browser",
    version: "v20",
    exitCode: 0,
    stdin,
    stdout: { write: (s: unknown) => (out.push(String(s)), true) },
    stderr: { write: (s: unknown) => (err.push(String(s)), true) },
    exit: () => {
      throw EXIT;
    },
    on() {
      return proc;
    },
    nextTick: (fn: () => void) => queueMicrotask(fn),
    hrtime: Object.assign(() => [0, 0], { bigint: () => BigInt(Math.round(performance.now() * 1e6)) }),
    memoryUsage: () => ({ rss: 0, heapUsed: 0 }),
  };

  return { require, console, process: proc, Buffer: MiniBuffer, pending, EXIT };
}

/* -------------------------------------------------------------- execution */

function compile(language: Job["language"], source: string): string {
  if (language !== "typescript") return source;
  return transform(source, { transforms: ["typescript", "imports"], disableESTransforms: true }).code;
}

async function drain(pending: (() => void)[], deadline: number) {
  // Let readline / stdin listeners and pending timers/promises settle.
  for (let round = 0; round < 50 && Date.now() < deadline; round++) {
    while (pending.length) pending.shift()!();
    await new Promise((r) => setTimeout(r, 0));
    if (!pending.length) break;
  }
}

self.onmessage = async (e: MessageEvent<Job>) => {
  const job = e.data;
  const emit = (stream: "out" | "err", text: string) =>
    self.postMessage({ id: job.id, type: "chunk", stream, text });

  let code: string;
  try {
    code = compile(job.language, job.source);
    // Syntax check once up-front, so syntax errors are reported as compile errors.
    new Function("require", "console", "process", "module", "exports", "Buffer", code);
  } catch (ex) {
    emit("err", `${ex instanceof Error ? `${ex.name}: ${ex.message}` : String(ex)}\n`);
    emit("out", `@@EZ:${job.nonce}:C\n`);
    self.postMessage({ id: job.id, type: "done" });
    return;
  }

  self.postMessage({ id: job.id, type: "started" });
  for (let i = 0; i < job.inputs.length; i++) {
    const out: string[] = [];
    const err: string[] = [];
    const rt = createRuntime(job.inputs[i], out, err);
    const mod = { exports: {} };
    let status = "ok";
    const t0 = performance.now();
    emit("out", `@@EZ:${job.nonce}:B:${i}\n`);
    self.postMessage({ id: job.id, type: "case", index: i });
    try {
      const fn = new Function("require", "console", "process", "module", "exports", "Buffer", code);
      const ret = fn(rt.require, rt.console, rt.process, mod, mod.exports, rt.Buffer);
      if (ret && typeof (ret as Promise<unknown>).then === "function") await ret;
      await drain(rt.pending, Date.now() + job.timeLimitMs);
    } catch (ex) {
      if (ex !== rt.EXIT) {
        status = "re";
        err.push(`${ex instanceof Error ? ex.stack || `${ex.name}: ${ex.message}` : String(ex)}\n`);
      }
    }
    const ms = performance.now() - t0;
    emit("out", `${out.join("")}\n@@EZ:${job.nonce}:E:${i}:${status}:${ms.toFixed(3)}:0\n`);
    emit("err", `@@EZ:${job.nonce}:B:${i}\n${err.join("").slice(-8000)}\n@@EZ:${job.nonce}:E:${i}\n`);
  }
  self.postMessage({ id: job.id, type: "done" });
};
