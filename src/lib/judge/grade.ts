// Turn raw batch execution into a LeetCode-style verdict. Shared by the browser
// and the server so both judges agree exactly.

import { outputsMatch } from "./compare";
import type { BatchRunResult, JudgeTest, SubmitResult, TestCaseResult, Verdict } from "./types";

export function gradeBatch(
  tests: JudgeTest[],
  run: BatchRunResult,
  meta: { verified: boolean },
): SubmitResult {
  const base = {
    total: tests.length,
    engine: run.engine,
    verified: meta.verified,
    runtimeMs: null as number | null,
    memoryKb: null as number | null,
  };

  if (run.compileError) {
    return {
      ...base,
      verdict: "Compile Error",
      allPassed: false,
      passedCount: 0,
      compileError: run.compileError,
      cases: [],
    };
  }

  if (run.error && run.cases.every((c) => c.status === "skipped")) {
    return {
      ...base,
      verdict: "Judge Error",
      allPassed: false,
      passedCount: 0,
      compileError: null,
      cases: [],
      judgeError: run.error,
    };
  }

  let passedCount = 0;
  let runtime = 0;
  let memory = 0;
  let firstFailure: Verdict | null = null;

  const cases: TestCaseResult[] = tests.map((t, i) => {
    const c = run.cases[i] ?? {
      index: i,
      status: "skipped" as const,
      stdout: "",
      stderr: "",
      timeMs: null,
      memoryKb: null,
    };
    const passed = c.status === "ok" && outputsMatch(c.stdout, t.expected);
    if (passed) passedCount++;
    runtime += c.timeMs ?? 0;
    memory = Math.max(memory, c.memoryKb ?? 0);
    if (!passed && !firstFailure) {
      firstFailure =
        c.status === "tle"
          ? "Time Limit Exceeded"
          : c.status === "re"
            ? "Runtime Error"
            : c.status === "skipped"
              ? "Time Limit Exceeded"
              : "Wrong Answer";
    }
    return {
      index: i,
      passed,
      input: t.input,
      expected: t.expected,
      got: c.stdout,
      stderr: c.stderr,
      hidden: !!t.hidden,
      status: c.status,
      error: c.status === "re" ? lastLine(c.stderr) : null,
      timedOut: c.status === "tle",
      timeMs: c.timeMs,
    };
  });

  const allPassed = passedCount === tests.length;
  return {
    ...base,
    verdict: allPassed ? "Accepted" : (firstFailure ?? "Wrong Answer"),
    allPassed,
    passedCount,
    compileError: null,
    cases,
    runtimeMs: runtime ? Math.max(1, Math.round(runtime)) : null,
    memoryKb: memory || null,
  };
}

function lastLine(s: string): string | null {
  const lines = s.trim().split("\n").filter(Boolean);
  return lines.length ? lines[lines.length - 1].slice(0, 300) : null;
}
