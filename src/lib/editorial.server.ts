// Editorial + multi-language worked solutions, generated once per problem.
//
// Solutions are written against the problem's exact starter signatures, so
// they can be loaded straight into the editor. When a verified judge exists,
// every solution is executed against it and labelled as passing or not.

import { aiJSON } from "./ai.server";
import { outputsMatch } from "./judge/compare";
import { runHarnessRemote } from "./judge/engine.server";
import { JUDGE_LANGS, type JudgeLang } from "./judge/languages";
import type { JudgeTest } from "./judge/types";

export type ApproachTag = "brute" | "better" | "optimal";

export type Approach = {
  name: string;
  tag: ApproachTag;
  summary: string;
  steps: string[];
  time: string;
  space: string;
  /** langKey -> full solution code in the starter's form. */
  code: Record<string, string>;
  /** langKey -> passed the problem's judge (absent = not checked). */
  verified?: Partial<Record<JudgeLang, boolean>>;
};

export type EditorialData = {
  slug: string;
  title: string;
  overview: string;
  intuition: string;
  hints: string[];
  approaches: Approach[];
  /** Common pitfalls and edge cases. */
  pitfalls?: string[];
  /** Related patterns / follow-up questions interviewers ask. */
  followUps?: string[];
  version?: number;
};

export const EDITORIAL_VERSION = 2;

const CODE_OBJECT = {
  type: "object",
  properties: {
    python: { type: "string" },
    javascript: { type: "string" },
    cpp: { type: "string" },
    java: { type: "string" },
  },
  required: ["python", "javascript", "cpp", "java"],
};

const SCHEMA = {
  name: "submit_editorial",
  description: "Submit the editorial.",
  parameters: {
    type: "object",
    properties: {
      overview: { type: "string", description: "1–2 sentences: what the problem asks." },
      intuition: { type: "string", description: "2–4 sentences building the key insight." },
      hints: {
        type: "array",
        items: { type: "string" },
        description: "3 progressive hints, vague to specific.",
      },
      pitfalls: {
        type: "array",
        items: { type: "string" },
        description: "2–4 common mistakes / edge cases.",
      },
      followUps: {
        type: "array",
        items: { type: "string" },
        description: "1–3 follow-up questions interviewers ask.",
      },
      approaches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            tag: { type: "string", enum: ["brute", "better", "optimal"] },
            summary: { type: "string" },
            steps: { type: "array", items: { type: "string" } },
            time: { type: "string" },
            space: { type: "string" },
            code: CODE_OBJECT,
          },
          required: ["name", "tag", "summary", "steps", "time", "space", "code"],
        },
      },
    },
    required: ["overview", "intuition", "hints", "approaches"],
  },
};

export type EditorialInput = {
  slug: string;
  title: string;
  difficulty: string;
  statement: string;
  starters: Partial<Record<JudgeLang, string>>;
};

function clean(d: Partial<EditorialData>, input: EditorialInput): EditorialData {
  if (!Array.isArray(d.approaches) || !d.approaches.length)
    throw new Error("Editorial missing approaches");
  const strs = (x: unknown) =>
    Array.isArray(x)
      ? x
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  return {
    slug: input.slug,
    title: input.title,
    overview: String(d.overview ?? ""),
    intuition: String(d.intuition ?? ""),
    hints: strs(d.hints).slice(0, 5),
    pitfalls: strs(d.pitfalls).slice(0, 5),
    followUps: strs(d.followUps).slice(0, 4),
    approaches: d.approaches.slice(0, 3).map((a) => {
      const code: Record<string, string> = {};
      for (const l of JUDGE_LANGS) {
        const v = (a.code as Record<string, unknown> | undefined)?.[l];
        if (typeof v === "string" && v.trim()) code[l] = v.replace(/^```\w*\n?|```\s*$/g, "");
      }
      return {
        name: String(a.name ?? "Approach"),
        tag: a.tag === "brute" || a.tag === "better" || a.tag === "optimal" ? a.tag : "optimal",
        summary: String(a.summary ?? ""),
        steps: strs(a.steps),
        time: String(a.time ?? "—"),
        space: String(a.space ?? "—"),
        code,
      };
    }),
    version: EDITORIAL_VERSION,
  };
}

export async function generateEditorial(input: EditorialInput): Promise<EditorialData> {
  const starters = JUDGE_LANGS.filter((l) => input.starters[l])
    .map((l) => `--- ${l} ---\n${input.starters[l]}`)
    .join("\n");

  const raw = await aiJSON<Partial<EditorialData>>(
    [
      {
        role: "system",
        content:
          "You are a world-class interview coach writing NeetCode-quality editorials. Explanations are clear and concise; every solution is correct, idiomatic and efficient.",
      },
      {
        role: "user",
        content: `Write the editorial for this problem.

Title: ${input.title}
Difficulty: ${input.difficulty}

Statement:
${input.statement.slice(0, 7000) || "(Use your knowledge of this well-known problem.)"}

Starter code — every solution MUST use exactly these class/function names and signatures, contain no main/driver and no I/O, so it can be pasted straight into the editor:
${starters || "(Use LeetCode's standard signature.)"}

Requirements:
- 2–3 approaches ordered brute force → optimal (tags "brute", "better", "optimal"). If there's essentially one idea, give a naive version and the clean optimal version.
- Each approach: a short summary, concrete numbered steps, precise Big-O time and space, and complete code in python, javascript, cpp and java.
- C++ may assume <bits/stdc++.h> and using namespace std; Java may assume java.util.*; don't add includes/imports.
- Plain text inside strings (no markdown).`,
      },
    ],
    SCHEMA,
    { tier: "smart", timeoutMs: 150_000 },
  );
  return clean(raw, input);
}

async function mapLimit<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

/** Run every solution against the judge and record which ones pass. */
export async function verifyEditorial(
  editorial: EditorialData,
  judge: { harness: Partial<Record<JudgeLang, string>>; tests: JudgeTest[] },
): Promise<EditorialData> {
  const small = judge.tests.filter((t) => t.input.length <= 400);
  const jobs: { a: Approach; lang: JudgeLang }[] = [];
  for (const a of editorial.approaches) {
    a.verified = {};
    for (const lang of JUDGE_LANGS) if (a.code[lang] && judge.harness[lang]) jobs.push({ a, lang });
  }
  await mapLimit(jobs, 4, async ({ a, lang }) => {
    // Brute force is only expected to be correct, not fast: check it on small inputs.
    const tests = a.tag === "brute" && small.length >= 3 ? small : judge.tests;
    const r = await runHarnessRemote({
      language: lang,
      harness: judge.harness[lang]!,
      userCode: a.code[lang],
      inputs: tests.map((t) => t.input),
    }).catch(() => null);
    if (!r || (r.error && r.cases.every((c) => c.status === "skipped"))) return; // unknown
    a.verified![lang] =
      !r.compileError &&
      tests.every(
        (t, i) => r.cases[i]?.status === "ok" && outputsMatch(r.cases[i].stdout, t.expected),
      );
  });
  return editorial;
}
