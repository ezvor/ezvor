// Trusted, server-side access to problem statements and judge specs.
//
// Clients only ever send a slug. Statements are fetched by the server (cache →
// LeetCode), so nobody can poison the shared caches with a forged statement.

import { PROBLEMS } from "@/data/problems";
import { cacheGet, cacheSet } from "./cache.server";
import type { HarnessData } from "./harness.server";
import type { JudgeLang } from "./judge/languages";
import type { JudgeTest } from "./judge/types";
import { fetchLeetProblem, type LeetProblem } from "./leetcode.server";

const SLUG_RE = /^[a-z0-9-]{1,120}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

const inflight = new Map<string, Promise<LeetProblem>>();

export async function getStatement(slug: string): Promise<LeetProblem> {
  if (!isValidSlug(slug)) throw new Error("Invalid problem id");
  const cached = await cacheGet<LeetProblem>("problem_statements", slug);
  if (cached) return cached;
  let p = inflight.get(slug);
  if (!p) {
    p = fetchLeetProblem(slug).then(async (problem) => {
      await cacheSet("problem_statements", slug, problem);
      return problem;
    });
    inflight.set(slug, p);
    p.finally(() => inflight.delete(slug)).catch(() => undefined);
  }
  return p;
}

export type ProblemContext = {
  slug: string;
  title: string;
  difficulty: string;
  statement: string;
  starters: Partial<Record<JudgeLang, string>>;
};

/** Title, plain-text statement and starters for AI prompts (curated or catalog). */
export async function getProblemContext(slug: string): Promise<ProblemContext> {
  const curated = PROBLEMS.find((p) => p.id === slug);
  if (curated) {
    const examples = curated.examples
      .map(
        (e, i) =>
          `Example ${i + 1}:\nInput: ${e.input}\nOutput: ${e.output}${e.explanation ? `\nExplanation: ${e.explanation}` : ""}`,
      )
      .join("\n\n");
    return {
      slug,
      title: curated.title,
      difficulty: curated.difficulty,
      statement: `${curated.description}\n\n${examples}\n\nConstraints:\n${curated.constraints.join("\n")}`,
      starters: curated.starters as Partial<Record<JudgeLang, string>>,
    };
  }
  const { toPlainText } = await import("./harness.server");
  const p = await getStatement(slug);
  return {
    slug,
    title: p.title,
    difficulty: p.difficulty,
    statement: toPlainText(p.contentHtml),
    starters: p.snippets as Partial<Record<JudgeLang, string>>,
  };
}

/** Judge harnesses + tests available for a problem (all languages). */
export async function getJudge(
  slug: string,
): Promise<{ harness: Partial<Record<JudgeLang, string>>; tests: JudgeTest[] } | null> {
  const curated = PROBLEMS.find((p) => p.id === slug);
  if (curated)
    return { harness: curated.harness as Partial<Record<JudgeLang, string>>, tests: curated.tests };
  const h = await cacheGet<HarnessData>("problem_harnesses", slug);
  return h?.tests?.length ? { harness: h.harness, tests: h.tests } : null;
}

export type TrustedSpec = {
  harness: string;
  tests: JudgeTest[];
  title: string;
  difficulty: string;
  topic: string | null;
};

/** The judge spec the server trusts for (slug, language), or null if unknown. */
export async function getTrustedSpec(
  slug: string,
  language: JudgeLang,
): Promise<TrustedSpec | null> {
  const curated = PROBLEMS.find((p) => p.id === slug);
  if (curated) {
    const harness = curated.harness[language];
    if (!harness) return null;
    return {
      harness,
      tests: curated.tests,
      title: curated.title,
      difficulty: curated.difficulty,
      topic: curated.topic,
    };
  }
  if (!isValidSlug(slug)) return null;
  const h = await cacheGet<HarnessData>("problem_harnesses", slug);
  const harness = h?.harness?.[language];
  if (!h || !harness || !h.tests?.length) return null;
  const statement = await cacheGet<LeetProblem>("problem_statements", slug);
  return {
    harness,
    tests: h.tests,
    title: statement?.title ?? slug,
    difficulty: statement?.difficulty ?? "Medium",
    topic: statement?.tags?.[0]?.name ?? null,
  };
}
