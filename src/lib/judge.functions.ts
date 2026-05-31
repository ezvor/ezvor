import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runCode, normalizeOutput, type LangKey, type RunResult } from "./judge.server";

const LANGS = ["python", "javascript", "typescript", "cpp", "c", "java", "go", "rust"] as const;

// Run code once with optional custom stdin (the "Run" button).
export const executeCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        language: z.enum(LANGS),
        source: z.string().min(1).max(60_000),
        stdin: z.string().max(20_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<RunResult> => {
    return runCode({
      language: data.language as LangKey,
      source: data.source,
      stdin: data.stdin ?? "",
    });
  });

export type TestCaseResult = {
  index: number;
  passed: boolean;
  input: string;
  expected: string;
  got: string;
  stderr: string;
  hidden: boolean;
  error: string | null;
  timedOut: boolean;
  timeMs: number | null;
};

export type SubmitResult = {
  allPassed: boolean;
  passedCount: number;
  total: number;
  compileError: string | null;
  cases: TestCaseResult[];
  runtimeMs: number | null;
  memoryKb: number | null;
};

// Run code against a set of test cases (the "Submit" button).
export const submitCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        language: z.enum(LANGS),
        source: z.string().min(1).max(60_000),
        tests: z
          .array(
            z.object({
              input: z.string().max(20_000),
              expected: z.string().max(20_000),
              hidden: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(40),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<SubmitResult> => {
    const cases: TestCaseResult[] = [];
    let compileError: string | null = null;
    let passedCount = 0;
    let runtimeMs = 0;
    let memoryKb = 0;

    for (let i = 0; i < data.tests.length; i++) {
      const t = data.tests[i];
      const result = await runCode({
        language: data.language as LangKey,
        source: data.source,
        stdin: t.input,
      });

      runtimeMs += result.timeMs ?? 0;
      memoryKb = Math.max(memoryKb, result.memoryKb ?? 0);

      // A compile error is the same for every test — report once and stop.
      if (result.compileOutput) {
        compileError = result.compileOutput;
        cases.push({
          index: i,
          passed: false,
          input: t.input,
          expected: t.expected,
          got: "",
          stderr: result.compileOutput,
          hidden: t.hidden ?? false,
          error: result.error,
          timedOut: result.timedOut,
          timeMs: result.timeMs,
        });
        break;
      }

      const got = normalizeOutput(result.stdout);
      const expected = normalizeOutput(t.expected);
      const passed = !result.error && !result.timedOut && got === expected;
      if (passed) passedCount++;

      cases.push({
        index: i,
        passed,
        input: t.input,
        expected: t.expected,
        got: result.stdout,
        stderr: result.stderr,
        hidden: t.hidden ?? false,
        error: result.error,
        timedOut: result.timedOut,
        timeMs: result.timeMs,
      });
    }

    return {
      allPassed: compileError === null && passedCount === data.tests.length,
      passedCount,
      total: data.tests.length,
      compileError,
      cases,
      runtimeMs: runtimeMs || null,
      memoryKb: memoryKb || null,
    };
  });
