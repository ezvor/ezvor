// Server-side batch execution on the remote runners.

import { buildBatchProgram, parseBatchOutput, remapUserLines, spliceUserCode } from "./batch";
import type { JudgeLang } from "./languages";
import { executeRemote } from "./runners.server";
import type { BatchRunResult, CaseRun } from "./types";

const PER_TEST_TL: Record<JudgeLang, number> = {
  python: 4000,
  javascript: 4000,
  cpp: 3000,
  java: 4000,
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Fallback: one remote execution per test (used when the harness can't be batched). */
async function runEach(
  language: JudgeLang,
  harness: string,
  userCode: string,
  inputs: string[],
): Promise<BatchRunResult> {
  const source = spliceUserCode(harness, userCode, language);
  let compileError: string | null = null;
  let engine = "remote";
  let infraError: string | null = null;
  const cases = await mapLimit(inputs, 3, async (stdin, index): Promise<CaseRun> => {
    const r = await executeRemote({ language, source, stdin, timeoutMs: PER_TEST_TL[language] * 3 });
    engine = r.engine ?? engine;
    if (r.compileOutput) compileError = r.compileOutput;
    if (r.error) infraError = r.error;
    return {
      index,
      status: r.error ? "skipped" : r.timedOut ? "tle" : r.exitCode && r.exitCode !== 0 ? "re" : "ok",
      stdout: r.stdout,
      stderr: r.stderr,
      timeMs: r.timeMs,
      memoryKb: r.memoryKb,
    };
  });
  return { compileError, cases, engine, error: infraError };
}

/** Execute `inputs` against a harness in as few remote round-trips as possible. */
export async function runHarnessRemote(opts: {
  language: JudgeLang;
  harness: string;
  userCode: string;
  inputs: string[];
}): Promise<BatchRunResult> {
  const { language, harness, userCode, inputs } = opts;
  if (!inputs.length) return { compileError: null, cases: [], engine: "none", error: null };

  const tl = PER_TEST_TL[language];
  const program = buildBatchProgram(language, harness, userCode, inputs, { timeLimitMs: tl });
  if (!program) return runEach(language, harness, userCode, inputs);

  const res = await executeRemote({
    language,
    source: program.source,
    stdin: program.stdin,
    timeoutMs: Math.min(tl * inputs.length + 8000, 55_000),
  });
  const engine = res.engine ?? "remote";
  if (res.error && !res.stdout) return { compileError: null, cases: [], engine, error: res.error };

  const remap = (t: string) => remapUserLines(t, program.userLineOffset, program.userLineCount);
  if (res.compileOutput) {
    return { compileError: remap(res.compileOutput), cases: [], engine, error: null };
  }

  const parsed = parseBatchOutput(program, inputs.length, res.stdout, res.stderr, res.timedOut);
  if (parsed.syntaxError) {
    return {
      compileError: remap(res.stderr.replace(/@@EZ:[^\n]*\n?/g, "").trim()),
      cases: [],
      engine,
      error: null,
    };
  }

  // The driver never started (e.g. an engine quirk): retry the slow, safe way.
  if (parsed.cases.every((c) => c.status === "skipped")) {
    return runEach(language, harness, userCode, inputs);
  }

  return {
    compileError: null,
    cases: parsed.cases.map((c) => ({ ...c, stderr: remap(c.stderr) })),
    engine,
    error: null,
  };
}
