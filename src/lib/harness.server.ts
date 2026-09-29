// Generates a *verified* judge for any catalog problem.
//
// Stage 1 — Python: the model writes a driver harness (on top of our standard
//   prelude), a reference solution and 10–14 tests in LeetCode's own input
//   format. We EXECUTE the reference against every test and check it against
//   LeetCode's official example outputs scraped from the statement. Only then
//   are the executed outputs adopted as the expected answers; the model's own
//   guesses are never trusted. One retry with the failure as feedback.
// Stage 2 — JavaScript, C++, Java in parallel: each gets the verified Python
//   harness as the format spec, writes its own harness + reference, and must
//   reproduce the canonical outputs exactly. One automatic repair round; a
//   language that still fails is simply not offered for submission.

import { aiJSON, type ChatMessage } from "./ai.server";
import { outputsMatch, normalizeOutput } from "./judge/compare";
import { runHarnessRemote } from "./judge/engine.server";
import { JUDGE_LANGS, type JudgeLang } from "./judge/languages";
import { CANONICAL_OUTPUT, PRELUDE_DOCS, PRELUDES } from "./judge/preludes";
import type { BatchRunResult } from "./judge/types";
import type { LeetProblem } from "./leetcode.server";

export type HarnessTest = { input: string; expected: string; hidden?: boolean };

export type HarnessData = {
  slug: string;
  ioFormat: string;
  tests: HarnessTest[];
  harness: Partial<Record<JudgeLang, string>>;
  version?: number;
  /** Expected outputs were produced by executing a reference that matches LeetCode's examples. */
  verified?: boolean;
  /** Languages whose harness passed end-to-end with a reference solution. */
  verifiedLangs?: JudgeLang[];
  generatedAt?: string;
  /** Server-only: reference solutions used for verification. Never sent to clients. */
  reference?: Partial<Record<JudgeLang, string>>;
};

export class UnsupportedProblemError extends Error {}

export const HARNESS_VERSION = 2;

export function publicHarness(h: HarnessData): HarnessData {
  const { reference: _reference, ...rest } = h;
  return rest;
}

/* ---------------------------------------------------------------- inputs */

export function toPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<sup>/gi, "^")
    .replace(/<\/(p|div|pre|li|h\d)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** "Output: [0,1]" lines from the statement's examples, in order. */
export function officialExampleOutputs(html: string): string[] {
  const text = toPlainText(html);
  const out: string[] = [];
  const re = /Output:?\s*\n?\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const v = m[1].trim();
    if (v && !/^Explanation/i.test(v)) out.push(v);
  }
  return out;
}

function parseJson(s: string): { ok: true; v: unknown } | { ok: false } {
  try {
    return { ok: true, v: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
}

function sortDeep(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  return v.map(sortDeep).sort((a, b) => {
    const x = JSON.stringify(a);
    const y = JSON.stringify(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/** Equal as-is, or equal ignoring order (problems that accept "any order"). */
function matchesOfficial(got: string, official: string): boolean {
  if (outputsMatch(got, official)) return true;
  const a = parseJson(normalizeOutput(got));
  const b = parseJson(normalizeOutput(official));
  if (a.ok && b.ok) return JSON.stringify(sortDeep(a.v)) === JSON.stringify(sortDeep(b.v));
  return false;
}

/* ---------------------------------------------------------------- prompts */

const SYSTEM = `You build automated online-judge harnesses for LeetCode problems. Your code is byte-exact and compiles on the first try.
Everything you write is verified by executing it, so correctness matters more than anything else. Keep reasoning brief and submit via the function.`;

const DRIVER_RULES = `DRIVER RULES
- The harness is code placed AFTER the prelude. It MUST contain the token __USER_CODE__ exactly once: the user's filled-in starter replaces it. Anything the starter needs that the prelude lacks (e.g. a special "Node" class for graph / N-ary / random-pointer problems) goes BEFORE __USER_CODE__; the driver goes AFTER it.
- Read stdin with the prelude's lines helper. Line k is argument k as a JSON value, exactly LeetCode's format. Convert with the prelude helpers, call the method, print exactly ONE line with the prelude's dump helper.
- Method returns void and mutates an argument ("do not return anything", "in-place"): print the mutated argument. "Return k and the first k elements" problems: print the first k elements (sorted if order doesn't matter).
- Several valid answers ("any order", "return any"): print a canonical form — sort the result (inner lists first, then the outer list). If no canonical form exists (e.g. any valid topological order), validate the answer in the driver and print true.
- Design problems (starter is a class such as LRUCache or MinStack): line 1 = operations array, line 2 = arguments array. Construct with the first operation, run the rest, print the results array (null for void), exactly like LeetCode's output.
- Problems with extra hidden parameters (e.g. "pos" for linked-list cycles): follow the example input lines exactly.
${CANONICAL_OUTPUT}`;

function pythonPrompt(problem: LeetProblem, officials: string[], feedback?: string): string {
  return `Problem: ${problem.title} (${problem.difficulty})

Statement:
${toPlainText(problem.contentHtml).slice(0, 6000)}

Python starter (the user's editor contains exactly this, filled in):
${problem.snippets.python}

LeetCode example input (one argument per line, examples back to back):
${problem.exampleTestcases || "(none)"}

Official example outputs, in order:
${officials.length ? officials.map((o, i) => `${i + 1}. ${o}`).join("\n") : "(not available)"}

${PRELUDE_DOCS.python}

${DRIVER_RULES}
- Python driver: instantiate Solution() (or the design class) and call the method.

Submit:
- harness: the Python harness (with __USER_CODE__).
- reference: a correct, efficient Python solution written exactly in the starter's form (same class, method and signature), no imports.
- tests: 10–14 tests. First ALL official examples in order (hidden=false), then edge cases (hidden=true): smallest inputs, duplicates, negatives, boundaries, and 2 larger inputs (100–300 elements written out literally). Inputs must satisfy the constraints and use the exact multi-line format above. "expected" = what the driver prints for a correct solution.
- ioFormat: one short line, e.g. "Line 1: nums (JSON array) · Line 2: target (int) → the answer as JSON".${
    feedback ? `\n\nYOUR PREVIOUS ATTEMPT FAILED VERIFICATION. Fix this:\n${feedback}` : ""
  }`;
}

function portPrompt(problem: LeetProblem, lang: JudgeLang, py: { harness: string }, samples: HarnessTest[]) {
  const langRules: Record<JudgeLang, string> = {
    python: "",
    javascript: "JavaScript: the starter is a plain function (or a class for design problems) — call it directly.",
    cpp: "C++: write int main(). Use ez::read<T> with the exact parameter types of the starter's method.",
    java: 'Java: the entry class must be exactly "public class Main" with "public static void main(String[] args) throws Exception"; read input ONLY via Ez.lines().',
  };
  return `Problem: ${problem.title}

${lang} starter (the user's editor contains exactly this, filled in):
${problem.snippets[lang]}

This VERIFIED Python harness defines the exact input and output format — reproduce it byte-for-byte:
${py.harness}

Sample tests (stdin → expected stdout):
${samples.map((t) => `${t.input}\n→ ${t.expected}`).join("\n\n")}

${PRELUDE_DOCS[lang]}

${DRIVER_RULES}
- ${langRules[lang]}

Submit:
- harness: the ${lang} harness (with __USER_CODE__).
- reference: a correct, efficient ${lang} solution written exactly in the starter's form (same names and signature). No imports/includes and no main — the prelude provides them.`;
}

const PY_SCHEMA = {
  name: "submit_python_judge",
  description: "Submit the Python harness, reference solution and tests.",
  parameters: {
    type: "object",
    properties: {
      ioFormat: { type: "string" },
      harness: { type: "string" },
      reference: { type: "string" },
      tests: {
        type: "array",
        items: {
          type: "object",
          properties: {
            input: { type: "string" },
            expected: { type: "string" },
            hidden: { type: "boolean" },
          },
          required: ["input", "expected"],
        },
      },
    },
    required: ["ioFormat", "harness", "reference", "tests"],
  },
};

const PORT_SCHEMA = {
  name: "submit_port",
  description: "Submit the harness and reference solution for one language.",
  parameters: {
    type: "object",
    properties: { harness: { type: "string" }, reference: { type: "string" } },
    required: ["harness", "reference"],
  },
};

/* ------------------------------------------------------------ execution */

function fullHarness(lang: JudgeLang, body: string): string {
  return `${PRELUDES[lang]}\n${body}`;
}

function run(lang: JudgeLang, harness: string, reference: string, tests: HarnessTest[]) {
  return runHarnessRemote({
    language: lang,
    harness: fullHarness(lang, harness),
    userCode: reference,
    inputs: tests.map((t) => t.input),
  });
}

function infraFailed(r: BatchRunResult): boolean {
  return !!r.error && r.cases.every((c) => c.status === "skipped");
}

function passes(r: BatchRunResult, expected: string[]): boolean {
  return (
    !r.compileError &&
    !r.error &&
    expected.every((e, i) => r.cases[i]?.status === "ok" && outputsMatch(r.cases[i].stdout, e))
  );
}

function describeFailure(lang: JudgeLang, r: BatchRunResult, tests: HarnessTest[], expected: string[]): string {
  if (r.compileError) return `${lang} compile error:\n${r.compileError.slice(0, 1500)}`;
  if (r.error) return `${lang} could not run: ${r.error}`;
  for (let i = 0; i < tests.length; i++) {
    const c = r.cases[i];
    if (!c || c.status !== "ok" || !outputsMatch(c.stdout, expected[i])) {
      return `${lang} test ${i + 1} failed (${c?.status === "ok" ? "wrong output" : (c?.status ?? "missing")}).
stdin:
${tests[i].input.slice(0, 500)}
expected: ${expected[i].slice(0, 300)}
got: ${(c?.stdout ?? "").trim().slice(0, 300)}
stderr: ${(c?.stderr ?? "").slice(0, 800)}`;
    }
  }
  return `${lang}: unknown failure`;
}

type PyStage = {
  ioFormat: string;
  harness: string;
  reference: string;
  tests: HarnessTest[];
};

type PyResult =
  | { ok: true; stage: PyStage }
  | { ok: false; feedback: string; infra?: boolean; draft?: PyStage };

function cleanTests(raw: unknown): HarnessTest[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((t): t is HarnessTest => !!t && typeof (t as HarnessTest).input === "string")
    .map((t) => ({
      input: t.input.replace(/\r\n/g, "\n").trim(),
      expected: String(t.expected ?? ""),
      hidden: !!t.hidden,
    }))
    .filter((t) => t.input.length > 0)
    .slice(0, 16);
}

async function pythonStage(problem: LeetProblem, officials: string[], feedback?: string): Promise<PyResult> {
  const raw = await aiJSON<{ ioFormat?: string; harness?: string; reference?: string; tests?: unknown }>(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: pythonPrompt(problem, officials, feedback) },
    ],
    PY_SCHEMA,
    { tier: "smart", timeoutMs: 120_000 },
  );
  const draft: PyStage = {
    ioFormat: String(raw.ioFormat ?? ""),
    harness: String(raw.harness ?? ""),
    reference: String(raw.reference ?? ""),
    tests: cleanTests(raw.tests),
  };
  if (!draft.harness.includes("__USER_CODE__")) {
    return { ok: false, feedback: "The harness must contain the __USER_CODE__ token.", draft };
  }
  if (draft.tests.length < 3) return { ok: false, feedback: "Provide 10–14 tests.", draft };

  const r = await run("python", draft.harness, draft.reference, draft.tests);
  if (infraFailed(r)) return { ok: false, feedback: r.error ?? "runner unavailable", infra: true, draft };
  if (r.compileError) {
    return { ok: false, feedback: describeFailure("python", r, draft.tests, draft.tests.map((t) => t.expected)), draft };
  }

  const exampleCount = draft.tests.filter((t) => !t.hidden).length;
  const officialsUsable = officials.length > 0 && officials.length === exampleCount;
  const validatorMode =
    officialsUsable &&
    r.cases.slice(0, exampleCount).every((c) => normalizeOutput(c.stdout) === "true") &&
    !officials.every((o) => o === "true");

  for (let i = 0; i < exampleCount; i++) {
    const c = r.cases[i];
    if (!c || c.status !== "ok") {
      return { ok: false, feedback: describeFailure("python", r, draft.tests, draft.tests.map((t) => t.expected)), draft };
    }
    if (officialsUsable && !validatorMode && !matchesOfficial(c.stdout, officials[i])) {
      return {
        ok: false,
        feedback: `For example ${i + 1} the reference printed ${normalizeOutput(c.stdout).slice(0, 300)} but LeetCode's official output is ${officials[i]}. Fix the reference solution and/or the driver's parsing and output formatting.`,
        draft,
      };
    }
  }

  // Adopt executed outputs as the truth; drop hidden tests the reference couldn't finish.
  const tests: HarnessTest[] = [];
  draft.tests.forEach((t, i) => {
    const c = r.cases[i];
    const out = c?.status === "ok" ? normalizeOutput(c.stdout) : "";
    if (out) tests.push({ input: t.input, expected: out, hidden: t.hidden });
  });
  if (tests.length < Math.min(3, draft.tests.length)) {
    return { ok: false, feedback: "Most tests crashed or timed out with the reference solution.", draft };
  }
  return { ok: true, stage: { ...draft, tests } };
}

async function portStage(
  problem: LeetProblem,
  lang: Exclude<JudgeLang, "python">,
  py: PyStage,
): Promise<{ harness: string; reference: string } | null> {
  if (!problem.snippets[lang]) return null;
  const expected = py.tests.map((t) => t.expected);
  const base: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: portPrompt(problem, lang, py, py.tests.slice(0, 3)) },
  ];
  let attempt = await aiJSON<{ harness: string; reference: string }>(base, PORT_SCHEMA, {
    tier: "smart",
    timeoutMs: 90_000,
  }).catch(() => null);

  for (let round = 0; round < 2 && attempt; round++) {
    if (!attempt.harness?.includes("__USER_CODE__")) {
      attempt = null;
      break;
    }
    const r = await run(lang, attempt.harness, attempt.reference, py.tests);
    if (passes(r, expected)) return attempt;
    if (infraFailed(r) || round === 1) break;
    attempt = await aiJSON<{ harness: string; reference: string }>(
      [
        ...base,
        { role: "assistant", content: JSON.stringify(attempt) },
        {
          role: "user",
          content: `That failed verification:\n${describeFailure(lang, r, py.tests, expected)}\n\nSubmit a corrected harness and reference.`,
        },
      ],
      PORT_SCHEMA,
      { tier: "smart", timeoutMs: 90_000 },
    ).catch(() => null);
  }
  return null;
}

/* ---------------------------------------------------------------- public */

const UNSUPPORTED_TAGS = new Set(["database", "shell", "concurrency"]);

export function isJudgeable(problem: LeetProblem): boolean {
  if (!problem.snippets.python) return false;
  return !problem.tags.some((t) => UNSUPPORTED_TAGS.has(t.slug));
}

export async function generateHarness(problem: LeetProblem): Promise<HarnessData> {
  if (!isJudgeable(problem)) {
    throw new UnsupportedProblemError(
      "This problem type (SQL, shell or concurrency) can't be judged in-app yet.",
    );
  }
  const officials = officialExampleOutputs(problem.contentHtml);

  let py = await pythonStage(problem, officials);
  if (!py.ok && !py.infra) py = await pythonStage(problem, officials, py.feedback);

  if (!py.ok) {
    // Couldn't verify (runners down or the model kept failing). Serve the
    // model's own Python judge so the problem stays practicable, clearly flagged.
    const draft = py.draft;
    if (!draft || !draft.harness.includes("__USER_CODE__") || !draft.tests.length) {
      throw new Error("Couldn't prepare a judge for this problem.");
    }
    return {
      slug: problem.slug,
      ioFormat: draft.ioFormat,
      tests: draft.tests,
      harness: { python: fullHarness("python", draft.harness) },
      verified: false,
      verifiedLangs: [],
      version: HARNESS_VERSION,
      generatedAt: new Date().toISOString(),
    };
  }

  const stage = py.stage;
  const ports = await Promise.all(
    (["javascript", "cpp", "java"] as const).map(async (lang) => [lang, await portStage(problem, lang, stage)] as const),
  );

  const harness: Partial<Record<JudgeLang, string>> = { python: fullHarness("python", stage.harness) };
  const reference: Partial<Record<JudgeLang, string>> = { python: stage.reference };
  for (const [lang, port] of ports) {
    if (!port) continue;
    harness[lang] = fullHarness(lang, port.harness);
    reference[lang] = port.reference;
  }

  return {
    slug: problem.slug,
    ioFormat: stage.ioFormat,
    tests: stage.tests,
    harness,
    reference,
    verified: true,
    verifiedLangs: JUDGE_LANGS.filter((l) => !!harness[l]),
    version: HARNESS_VERSION,
    generatedAt: new Date().toISOString(),
  };
}
