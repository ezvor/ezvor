// Batch drivers: run every test case of a submission in ONE execution.
//
// A problem harness is "<preamble> __USER_CODE__ <driver>" and reads a single
// test from stdin. Instead of paying one remote round-trip (and one compile)
// per test, we wrap the harness in a tiny language-specific driver that:
//   - receives all test inputs on stdin as length-prefixed frames,
//   - executes the harness once per test in isolation (fresh globals in
//     Python/JS, a forked child process in C++, a fresh thread in Java),
//   - enforces a per-test time limit,
//   - prints each test's stdout/stderr between nonce-tagged markers along with
//     its status, wall time and peak memory.
//
// The same Python/JS drivers run on the server runners and inside the browser
// workers, so results are identical no matter where the code executes.

import type { JudgeLang } from "./languages";
import type { CaseRun, CaseStatus } from "./types";

export const USER_CODE_TOKEN = "__USER_CODE__";

export type BatchProgram = {
  language: JudgeLang;
  source: string;
  stdin: string;
  nonce: string;
  /** Lines that precede the user's code in `source` (for error line remapping). */
  userLineOffset: number;
  userLineCount: number;
};

export type BatchOptions = {
  /** Per-test time limit in milliseconds. */
  timeLimitMs?: number;
};

const DEFAULT_TL: Record<JudgeLang, number> = {
  python: 4000,
  javascript: 4000,
  cpp: 3000,
  java: 4000,
};

function makeNonce(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Length-prefixed frames: "<count>\n" then "<byteLength>\n<bytes>" per test. */
export function encodeFrames(inputs: string[]): string {
  const enc = new TextEncoder();
  let out = `${inputs.length}\n`;
  for (const input of inputs) out += `${enc.encode(input).length}\n${input}`;
  return out;
}

const JAVA_IMPORT_RE = /^[ \t]*import[ \t]+(?:static[ \t]+)?[\w.]+(?:\.\*)?[ \t]*;[ \t]*$/gm;

/**
 * Java only allows imports at the top of a file, but users often paste
 * solutions that start with imports. Blank them in place (keeping line
 * numbers) and return them so they can be put on the file's first line.
 */
export function hoistJavaImports(code: string): { imports: string; code: string } {
  const found = code.match(JAVA_IMPORT_RE);
  if (!found) return { imports: "", code };
  return {
    imports: found.map((s) => s.trim()).join(" "),
    code: code.replace(JAVA_IMPORT_RE, ""),
  };
}

export function spliceUserCode(harness: string, userCode: string, language?: string): string {
  const at = harness.indexOf(USER_CODE_TOKEN);
  if (at === -1) return harness;
  if (language === "java") {
    const { imports, code } = hoistJavaImports(userCode);
    const body = harness.slice(0, at) + code + harness.slice(at + USER_CODE_TOKEN.length);
    return imports ? `${imports}\n${body}` : body;
  }
  return harness.slice(0, at) + userCode + harness.slice(at + USER_CODE_TOKEN.length);
}

function countLines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}

/* ------------------------------------------------------------------ Python */

function pythonDriver(source: string, nonce: string, tlSec: number): string {
  return `import sys as _ez_sys, io as _ez_io, time as _ez_time, traceback as _ez_tb, base64 as _ez_b64
try:
    import resource as _ez_res
except Exception:
    _ez_res = None
try:
    import signal as _ez_sig
except Exception:
    _ez_sig = None

class _EzTimeout(BaseException):
    pass

def _ez_alarm(signum, frame):
    raise _EzTimeout()

def _ez_frames(b):
    pos = b.index(b"\\n")
    n = int(b[:pos])
    pos += 1
    out = []
    for _ in range(n):
        nl = b.index(b"\\n", pos)
        size = int(b[pos:nl])
        pos = nl + 1
        out.append(b[pos:pos + size].decode("utf-8"))
        pos += size
    return out

def _ez_peak_kb():
    if _ez_res is None:
        return 0
    try:
        return int(_ez_res.getrusage(_ez_res.RUSAGE_SELF).ru_maxrss)
    except Exception:
        return 0

def _ez_main():
    nonce = "${nonce}"
    real_out, real_err = _ez_sys.stdout, _ez_sys.stderr
    src = _ez_b64.b64decode("${toBase64Utf8(source)}").decode("utf-8")
    try:
        code = compile(src, "solution.py", "exec")
    except SyntaxError:
        _ez_tb.print_exc(limit=0, file=real_err)
        real_out.write("@@EZ:%s:C\\n" % nonce)
        real_out.flush()
        return
    tests = _ez_frames(_ez_sys.stdin.buffer.read())
    timer = False
    if _ez_sig is not None and hasattr(_ez_sig, "setitimer"):
        try:
            _ez_sig.signal(_ez_sig.SIGALRM, _ez_alarm)
            timer = True
        except Exception:
            timer = False
    _ez_sys.setrecursionlimit(100000)
    for i, data in enumerate(tests):
        out, err = _ez_io.StringIO(), _ez_io.StringIO()
        status = "ok"
        _ez_sys.stdin, _ez_sys.stdout, _ez_sys.stderr = _ez_io.StringIO(data), out, err
        t0 = _ez_time.perf_counter()
        try:
            if timer:
                _ez_sig.setitimer(_ez_sig.ITIMER_REAL, ${tlSec})
            exec(code, {"__name__": "__main__", "__builtins__": __builtins__})
        except SystemExit:
            pass
        except _EzTimeout:
            status = "tle"
        except BaseException:
            status = "re"
            _ez_tb.print_exc(file=err)
        finally:
            if timer:
                _ez_sig.setitimer(_ez_sig.ITIMER_REAL, 0)
        ms = (_ez_time.perf_counter() - t0) * 1000.0
        _ez_sys.stdin, _ez_sys.stdout, _ez_sys.stderr = _ez_sys.__stdin__, real_out, real_err
        real_out.write("@@EZ:%s:B:%d\\n%s\\n@@EZ:%s:E:%d:%s:%.3f:%d\\n" % (nonce, i, out.getvalue(), nonce, i, status, ms, _ez_peak_kb()))
        real_out.flush()
        real_err.write("@@EZ:%s:B:%d\\n%s\\n@@EZ:%s:E:%d\\n" % (nonce, i, err.getvalue()[-8000:], nonce, i))
        real_err.flush()

_ez_main()
`;
}

/* -------------------------------------------------------------- JavaScript */

function javascriptDriver(source: string, nonce: string, tlMs: number): string {
  return `"use strict";
const __ez_vm = require("vm");
const __ez_fs = require("fs");
const __ez_util = require("util");
(function () {
  const NONCE = "${nonce}";
  const src = Buffer.from("${toBase64Utf8(source)}", "base64").toString("utf8");
  let script;
  try {
    script = new __ez_vm.Script(src, { filename: "solution.js" });
  } catch (e) {
    process.stderr.write(String((e && e.stack) || e) + "\\n");
    process.stdout.write("@@EZ:" + NONCE + ":C\\n");
    return;
  }
  const buf = __ez_fs.readFileSync(0);
  let pos = 0;
  const num = () => { const nl = buf.indexOf(10, pos); const v = parseInt(buf.toString("utf8", pos, nl), 10); pos = nl + 1; return v; };
  const n = num();
  const tests = [];
  for (let i = 0; i < n; i++) { const len = num(); tests.push(buf.toString("utf8", pos, pos + len)); pos += len; }
  const EXIT = { ezExit: true };
  for (let i = 0; i < n; i++) {
    const input = tests[i];
    const out = [];
    const err = [];
    const fmt = (args) => __ez_util.format.apply(null, args);
    const fakeFs = Object.assign({}, __ez_fs, {
      readFileSync(p, o) {
        if (p === 0 || p === "/dev/stdin") {
          const enc = typeof o === "string" ? o : o && o.encoding;
          return enc ? input : Buffer.from(input);
        }
        return __ez_fs.readFileSync(p, o);
      },
    });
    const con = {
      log: (...a) => { out.push(fmt(a) + "\\n"); },
      info: (...a) => { out.push(fmt(a) + "\\n"); },
      debug: (...a) => { out.push(fmt(a) + "\\n"); },
      dir: (x) => { out.push(__ez_util.inspect(x) + "\\n"); },
      error: (...a) => { err.push(fmt(a) + "\\n"); },
      warn: (...a) => { err.push(fmt(a) + "\\n"); },
      trace: (...a) => { err.push(fmt(a) + "\\n"); },
    };
    const proc = {
      argv: ["node", "solution.js"], env: {}, platform: process.platform, version: process.version,
      versions: process.versions, hrtime: process.hrtime, memoryUsage: process.memoryUsage,
      nextTick: process.nextTick, cwd: process.cwd, exit: () => { throw EXIT; },
      on: function () { return this; }, stdin: { fd: 0 },
      stdout: { write: (s) => { out.push(String(s)); return true; } },
      stderr: { write: (s) => { err.push(String(s)); return true; } },
    };
    const req = (m) => (m === "fs" || m === "node:fs" ? fakeFs : require(m));
    const mod = { exports: {} };
    const ctx = __ez_vm.createContext({
      require: req, console: con, process: proc, module: mod, exports: mod.exports, Buffer,
      setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, queueMicrotask,
      TextEncoder, TextDecoder, URL, structuredClone, __filename: "solution.js", __dirname: ".",
    });
    let status = "ok";
    const t0 = process.hrtime.bigint();
    try {
      script.runInContext(ctx, { timeout: ${tlMs} });
    } catch (e) {
      if (e === EXIT) { /* process.exit() */ }
      else if (e && e.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") status = "tle";
      else { status = "re"; err.push(String((e && e.stack) || e) + "\\n"); }
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const mem = Math.round(process.memoryUsage().rss / 1024);
    process.stdout.write("@@EZ:" + NONCE + ":B:" + i + "\\n" + out.join("") + "\\n@@EZ:" + NONCE + ":E:" + i + ":" + status + ":" + ms.toFixed(3) + ":" + mem + "\\n");
    process.stderr.write("@@EZ:" + NONCE + ":B:" + i + "\\n" + err.join("").slice(-8000) + "\\n@@EZ:" + NONCE + ":E:" + i + "\\n");
  }
})();
`;
}

/* --------------------------------------------------------------------- C++ */

// The harness keeps its own main(). A static initializer (which runs before
// main) forks once per test: each child returns from the initializer with
// stdin wired to that test's input and proceeds into the harness's main();
// the parent only supervises and never reaches main().
function cppDriver(pre: string, userCode: string, post: string, nonce: string, tlMs: number) {
  if (!/\bmain\s*\(/.test(post)) return null;
  const tlSec = Math.max(1, Math.ceil(tlMs / 1000));
  const driver = `
// ---- batch driver ----
#include <unistd.h>
#include <sys/wait.h>
#include <sys/resource.h>
#include <signal.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <iostream>
#include <chrono>
#include <exception>
static void __ez_on_terminate() { std::cout.flush(); std::fflush(stdout); std::abort(); }
static int __ez_supervise() {
  const char* NONCE = "${nonce}";
  std::signal(SIGPIPE, SIG_IGN);
  std::string all;
  { char b[65536]; size_t r; while ((r = std::fread(b, 1, sizeof b, stdin)) > 0) all.append(b, r); }
  size_t pos = 0;
  auto num = [&]() -> long { size_t nl = all.find('\\n', pos); long v = std::strtol(all.c_str() + pos, nullptr, 10); pos = nl + 1; return v; };
  long n = num();
  std::vector<std::string> tests;
  for (long i = 0; i < n; i++) { long len = num(); tests.push_back(all.substr(pos, (size_t)len)); pos += (size_t)len; }
  for (long i = 0; i < n; i++) {
    std::fflush(stdout); std::fflush(stderr);
    std::printf("@@EZ:%s:B:%ld\\n", NONCE, i); std::fflush(stdout);
    std::fprintf(stderr, "@@EZ:%s:B:%ld\\n", NONCE, i); std::fflush(stderr);
    int fds[2];
    if (pipe(fds) != 0) _exit(1);
    auto t0 = std::chrono::steady_clock::now();
    pid_t pid = fork();
    if (pid == 0) {
      close(fds[1]); dup2(fds[0], 0); close(fds[0]);
      std::clearerr(stdin); std::cin.clear();
      std::set_terminate(__ez_on_terminate);
      alarm(${tlSec});
      return 0;  // continue into the harness's main()
    }
    close(fds[0]);
    const std::string& in = tests[(size_t)i];
    size_t off = 0;
    while (off < in.size()) { ssize_t w = write(fds[1], in.data() + off, in.size() - off); if (w <= 0) break; off += (size_t)w; }
    close(fds[1]);
    int st = 0; struct rusage ru; std::memset(&ru, 0, sizeof ru);
    wait4(pid, &st, 0, &ru);
    double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
    const char* kind = "ok";
    if (WIFSIGNALED(st)) { int sig = WTERMSIG(st); kind = (sig == SIGALRM || sig == SIGXCPU) ? "tle" : "re"; if (sig != SIGALRM) std::fprintf(stderr, "Process terminated by signal %d (%s)\\n", sig, strsignal(sig)); }
    else if (WIFEXITED(st) && WEXITSTATUS(st) != 0) { kind = "re"; std::fprintf(stderr, "Process exited with code %d\\n", WEXITSTATUS(st)); }
    std::printf("\\n@@EZ:%s:E:%ld:%s:%.3f:%ld\\n", NONCE, i, kind, ms, (long)ru.ru_maxrss); std::fflush(stdout);
    std::fprintf(stderr, "\\n@@EZ:%s:E:%ld\\n", NONCE, i); std::fflush(stderr);
  }
  std::fflush(stdout); std::fflush(stderr);
  _exit(0);
}
static int __ez_supervisor_token = __ez_supervise();
`;
  return pre + userCode + post + driver;
}

/* -------------------------------------------------------------------- Java */

function javaDriver(pre: string, userCode: string, post: string, nonce: string, tlMs: number) {
  const renameMain = (s: string) =>
    s
      .replace(/\bpublic\s+(final\s+)?class\s+Main\b/g, "class __EzMain")
      .replace(/\bMain\b/g, "__EzMain");
  const preR = renameMain(pre);
  const postR = renameMain(post);
  if (!/class\s+__EzMain\b/.test(preR + postR)) return null;
  const driver = `
// ---- batch driver ----
class Main {
  private static int ezPos = 0;
  private static int ezNum(byte[] b) { int v = 0; while (b[ezPos] != '\\n') { v = v * 10 + (b[ezPos] - '0'); ezPos++; } ezPos++; return v; }
  public static void main(String[] ezArgs) throws Exception {
    final String NONCE = "${nonce}";
    final java.io.PrintStream realOut = System.out;
    final java.io.PrintStream realErr = System.err;
    final byte[] all = System.in.readAllBytes();
    final int n = ezNum(all);
    for (int i = 0; i < n; i++) {
      final int len = ezNum(all);
      final byte[] in = java.util.Arrays.copyOfRange(all, ezPos, ezPos + len);
      ezPos += len;
      final java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
      final java.io.ByteArrayOutputStream be = new java.io.ByteArrayOutputStream();
      final java.io.PrintStream po = new java.io.PrintStream(bo, false, "UTF-8");
      final java.io.PrintStream pe = new java.io.PrintStream(be, true, "UTF-8");
      System.setIn(new java.io.ByteArrayInputStream(in));
      System.setOut(po);
      System.setErr(pe);
      final Throwable[] thrown = { null };
      Thread t = new Thread(null, () -> {
        try { __EzMain.main(new String[0]); } catch (Throwable e) { thrown[0] = e; }
      }, "ez-main", 1L << 28);
      t.setDaemon(true);
      long t0 = System.nanoTime();
      t.start();
      t.join(${tlMs});
      boolean alive = t.isAlive();
      double ms = (System.nanoTime() - t0) / 1e6;
      po.flush();
      System.setOut(realOut);
      System.setErr(realErr);
      String status = "ok";
      if (alive) status = "tle";
      else if (thrown[0] != null) { status = "re"; thrown[0].printStackTrace(pe); }
      pe.flush();
      Runtime rt = Runtime.getRuntime();
      long mem = (rt.totalMemory() - rt.freeMemory()) / 1024;
      realOut.print("@@EZ:" + NONCE + ":B:" + i + "\\n" + bo.toString("UTF-8") + "\\n@@EZ:" + NONCE + ":E:" + i + ":" + status + ":" + String.format(java.util.Locale.ROOT, "%.3f", ms) + ":" + mem + "\\n");
      realOut.flush();
      String errText = be.toString("UTF-8");
      if (errText.length() > 8000) errText = errText.substring(errText.length() - 8000);
      realErr.print("@@EZ:" + NONCE + ":B:" + i + "\\n" + errText + "\\n@@EZ:" + NONCE + ":E:" + i + "\\n");
      realErr.flush();
      if (alive) System.exit(0);
    }
    System.exit(0);
  }
}
`;
  return preR + userCode + postR + driver;
}

/* ------------------------------------------------------------------ public */

/**
 * Build a single program that runs `inputs` against `harness` + `userCode`.
 * Returns null when the harness shape isn't recognised; callers then fall back
 * to one execution per test.
 */
export function buildBatchProgram(
  language: JudgeLang,
  harness: string,
  userCode: string,
  inputs: string[],
  opts: BatchOptions = {},
): BatchProgram | null {
  const at = harness.indexOf(USER_CODE_TOKEN);
  if (at === -1) return null;
  let pre = harness.slice(0, at);
  const post = harness.slice(at + USER_CODE_TOKEN.length);
  if (language === "java") {
    const hoisted = hoistJavaImports(userCode);
    if (hoisted.imports) {
      pre = `${hoisted.imports}\n${pre}`;
      userCode = hoisted.code;
    }
  }
  const nonce = makeNonce();
  const tl = opts.timeLimitMs ?? DEFAULT_TL[language];
  const stdin = encodeFrames(inputs);
  const userLineOffset = countLines(pre);
  const userLineCount = countLines(userCode) + 1;

  let source: string | null;
  switch (language) {
    case "python":
      source = pythonDriver(pre + userCode + post, nonce, tl / 1000);
      // Python compiles the harness itself as "solution.py", so offsets apply as-is.
      break;
    case "javascript":
      source = javascriptDriver(pre + userCode + post, nonce, tl);
      break;
    case "cpp":
      source = cppDriver(pre, userCode, post, nonce, tl);
      break;
    case "java":
      source = javaDriver(pre, userCode, post, nonce, tl);
      break;
    default:
      source = null;
  }
  if (!source) return null;
  return { language, source, stdin, nonce, userLineOffset, userLineCount };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Segment = { text: string; closed: boolean; status?: string; ms?: number; mem?: number };

function splitSegments(stream: string, nonce: string): Map<number, Segment> {
  const out = new Map<number, Segment>();
  const n = escapeRe(nonce);
  const begin = new RegExp(`@@EZ:${n}:B:(\\d+)\\n`, "g");
  let m: RegExpExecArray | null;
  const starts: { index: number; bodyStart: number; at: number }[] = [];
  while ((m = begin.exec(stream))) {
    starts.push({ index: Number(m[1]), bodyStart: m.index + m[0].length, at: m.index });
  }
  for (let k = 0; k < starts.length; k++) {
    const s = starts[k];
    const limit = k + 1 < starts.length ? starts[k + 1].at : stream.length;
    const region = stream.slice(s.bodyStart, limit);
    const end = new RegExp(`\\n?@@EZ:${n}:E:${s.index}(?![\\d])(?::(\\w+):([\\d.]+):(\\d+))?\\n?`);
    const e = end.exec(region);
    if (e) {
      out.set(s.index, {
        text: region.slice(0, e.index),
        closed: true,
        status: e[1],
        ms: e[2] ? Number(e[2]) : undefined,
        mem: e[3] ? Number(e[3]) : undefined,
      });
    } else {
      out.set(s.index, { text: region, closed: false });
    }
  }
  return out;
}

export type ParsedBatch = {
  syntaxError: boolean;
  cases: CaseRun[];
};

/**
 * Parse a batch run's output. `runnerTimedOut` tells us whether the runner
 * itself killed the process (so an unterminated test is a TLE, not a crash).
 */
export function parseBatchOutput(
  program: Pick<BatchProgram, "nonce">,
  total: number,
  stdout: string,
  stderr: string,
  runnerTimedOut = false,
): ParsedBatch {
  const syntaxError = stdout.includes(`@@EZ:${program.nonce}:C`);
  const outSeg = splitSegments(stdout, program.nonce);
  const errSeg = splitSegments(stderr, program.nonce);
  const cases: CaseRun[] = [];
  let aborted = false;
  for (let i = 0; i < total; i++) {
    const o = outSeg.get(i);
    const e = errSeg.get(i);
    if (!o || aborted) {
      cases.push({
        index: i,
        status: "skipped",
        stdout: "",
        stderr: "",
        timeMs: null,
        memoryKb: null,
      });
      continue;
    }
    let status: CaseStatus;
    if (o.closed) {
      status = o.status === "tle" ? "tle" : o.status === "re" ? "re" : "ok";
    } else {
      status = runnerTimedOut ? "tle" : "re";
      aborted = true;
    }
    cases.push({
      index: i,
      status,
      stdout: o.text,
      stderr: e?.text ?? "",
      timeMs: o.ms != null ? Math.round(o.ms * 100) / 100 : null,
      memoryKb: o.mem != null && o.mem > 0 ? o.mem : null,
    });
    if (status === "tle" && !o.closed) aborted = true;
  }
  return { syntaxError, cases };
}

/**
 * Rewrite compiler / traceback line numbers so they point at the user's code
 * (line 1 = first line in the editor) instead of the hidden harness.
 */
export function remapUserLines(text: string, offset: number, userLines: number): string {
  if (!text || offset <= 0) return text;
  const fix = (n: number) => {
    const u = n - offset;
    return u >= 1 && u <= userLines ? u : null;
  };
  return text
    .replace(/(solution\.(?:py|js)", line |solution\.js:)(\d+)/g, (m, p: string, d: string) => {
      const u = fix(Number(d));
      return u ? `${p}${u}` : m;
    })
    .replace(/((?:prog|Main|main|solution)\.(?:cpp|cc|java)):(\d+)/g, (m, f: string, d: string) => {
      const u = fix(Number(d));
      return u ? `${f}:${u}` : m;
    });
}
