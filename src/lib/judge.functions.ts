// Client-callable code execution + judging.
//
//  executeCode   — run a program once with stdin (compiler, custom input).
//  runTests      — run a harness against the user's own inputs (the "Run" button
//                  for languages that can't execute in the browser).
//  submitSolution — the trusted "Submit": the server looks up the hidden tests
//                  itself, judges, and (for signed-in users) records the result.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runHarnessRemote } from "./judge/engine.server";
import { gradeBatch } from "./judge/grade";
import { JUDGE_LANGS, LANG_KEYS, type JudgeLang, type LangKey } from "./judge/languages";
import { executeRemote } from "./judge/runners.server";
import type { BatchRunResult, JudgeTest, RunResult, SubmitResult } from "./judge/types";
import { enforceRateLimit } from "./rate-limit.server";

export type { RunResult, SubmitResult, BatchRunResult };
export type { TestCaseResult } from "./judge/types";

const MAX_SOURCE = 64_000;
const MAX_INPUT = 64_000;

export const executeCode = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        language: z.enum(LANG_KEYS),
        source: z.string().min(1).max(MAX_SOURCE),
        stdin: z.string().max(MAX_INPUT).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<RunResult> => {
    enforceRateLimit("run");
    return executeRemote({
      language: data.language as LangKey,
      source: data.source,
      stdin: data.stdin ?? "",
      timeoutMs: 20_000,
    });
  });

export const runTests = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        language: z.enum(JUDGE_LANGS),
        harness: z.string().min(1).max(MAX_SOURCE),
        code: z.string().max(MAX_SOURCE),
        inputs: z.array(z.string().max(MAX_INPUT)).min(1).max(12),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<BatchRunResult> => {
    enforceRateLimit("run");
    return runHarnessRemote({
      language: data.language,
      harness: data.harness,
      userCode: data.code,
      inputs: data.inputs,
    });
  });

const TestSchema = z.object({
  input: z.string().max(MAX_INPUT),
  expected: z.string().max(MAX_INPUT),
  hidden: z.boolean().optional(),
});

/** Keep hidden inputs private: only the first failing hidden case is revealed, like LeetCode. */
function redactHidden(result: SubmitResult): SubmitResult {
  const firstFail = result.cases.find((c) => !c.passed)?.index;
  return {
    ...result,
    cases: result.cases.map((c) =>
      c.hidden && c.index !== firstFail
        ? { ...c, input: "", expected: "", got: c.passed ? "" : c.got }
        : c,
    ),
  };
}

function statusOf(r: SubmitResult): string {
  return r.verdict === "Judge Error" ? "Runtime Error" : r.verdict;
}

export const submitSolution = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator((input) =>
    z
      .object({
        slug: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .regex(/^[a-z0-9-]+$/),
        language: z.enum(JUDGE_LANGS),
        code: z.string().min(1).max(MAX_SOURCE),
        /** Used only when the server has no trusted judge for the problem (result is unverified). */
        fallback: z
          .object({
            harness: z
              .string()
              .min(1)
              .max(MAX_SOURCE * 2),
            tests: z.array(TestSchema).min(1).max(40),
          })
          .optional(),
        meta: z
          .object({
            title: z.string().max(200),
            difficulty: z.string().max(20),
            topic: z.string().max(80).nullable().optional(),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SubmitResult> => {
    const { getTrustedSpec } = await import("./problem-source.server");
    const userId = context.userId as string | null;
    enforceRateLimit("run", { userId });

    const language = data.language as JudgeLang;
    const trusted = await getTrustedSpec(data.slug, language);
    const spec: { harness: string; tests: JudgeTest[] } | null =
      trusted ??
      (data.fallback ? { harness: data.fallback.harness, tests: data.fallback.tests } : null);
    if (!spec) {
      return {
        verdict: "Judge Error",
        allPassed: false,
        passedCount: 0,
        total: 0,
        compileError: null,
        cases: [],
        runtimeMs: null,
        memoryKb: null,
        engine: "none",
        verified: false,
        judgeError: "The judge for this problem isn't ready yet. Try again in a moment.",
      };
    }

    const run = await runHarnessRemote({
      language,
      harness: spec.harness,
      userCode: data.code,
      inputs: spec.tests.map((t) => t.input),
    });
    const result = gradeBatch(spec.tests, run, { verified: !!trusted });

    if (userId && trusted && result.verdict !== "Judge Error") {
      result.recorded = await recordResult(userId, data.slug, language, data.code, result, {
        title: trusted.title || data.meta?.title || data.slug,
        difficulty: trusted.difficulty || data.meta?.difficulty || "Medium",
        topic: trusted.topic ?? data.meta?.topic ?? null,
      }).catch((e) => {
        console.error("[judge] failed to record submission", e);
        return false;
      });
    }
    return redactHidden(result);
  });

async function recordResult(
  userId: string,
  slug: string,
  language: JudgeLang,
  code: string,
  result: SubmitResult,
  meta: { title: string; difficulty: string; topic: string | null },
): Promise<boolean> {
  const { isAdminConfigured, supabaseAdmin } =
    await import("@/integrations/supabase/client.server");
  if (!isAdminConfigured()) return false;

  const { error } = await supabaseAdmin.from("code_submissions").insert({
    user_id: userId,
    problem_slug: slug,
    problem_title: meta.title,
    status: statusOf(result),
    language,
    passed: result.passedCount,
    total: result.total,
    runtime_ms: result.runtimeMs,
    memory_kb: result.memoryKb,
    code,
    engine: result.engine,
    verified: result.verified,
  });
  if (error) throw error;

  if (result.allPassed) {
    const { error: solvedError } = await supabaseAdmin.from("solved_problems").upsert(
      {
        user_id: userId,
        problem_id: slug,
        problem_title: meta.title,
        difficulty: meta.difficulty,
        topic: meta.topic,
        language,
        runtime_ms: result.runtimeMs,
        memory_kb: result.memoryKb,
        solved_at: new Date().toISOString(),
      },
      // Keep the first-solve record (date + stats) stable on re-solves.
      { onConflict: "user_id,problem_id", ignoreDuplicates: true },
    );
    if (solvedError) throw solvedError;
  }
  return true;
}
