// Server-only: generate a runnable execution HARNESS + test cases for any
// LeetCode-catalog problem so it can be run and auto-judged in-app exactly
// like the curated set.
//
// A "harness" is the hidden per-language wrapper injected around the user's
// visible `class Solution` code (LeetCode style, no imports / no main). It
// contains: language preamble (imports + any ListNode/TreeNode helpers), stdin
// parsing, the call into Solution, and canonical stdout formatting. The token
// `__USER_CODE__` marks where the editor contents are spliced in.
//
// Output is strict JSON, cached per-slug so repeat opens are instant.

import { callAI } from "./ai.server";
import type { LangKey } from "./judge.server";

export type HarnessTest = { input: string; expected: string; hidden?: boolean };

export type HarnessData = {
  slug: string;
  ioFormat: string;
  tests: HarnessTest[];
  harness: Partial<Record<LangKey, string>>;
};

const LANGS = ["python", "javascript", "cpp", "java"] as const;

function toPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<sup>/gi, "^")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function extractJson(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in AI response");
  return s.slice(start, end + 1);
}

function validate(data: unknown, slug: string): HarnessData {
  const d = data as Partial<HarnessData> & { harness?: Record<string, string> };
  const harness: Partial<Record<LangKey, string>> = {};
  for (const l of LANGS) {
    const v = d.harness?.[l];
    if (typeof v === "string" && v.includes("__USER_CODE__")) harness[l] = v;
  }
  if (!harness.python) {
    throw new Error("Harness generation incomplete (missing python wrapper)");
  }
  const tests: HarnessTest[] = Array.isArray(d.tests)
    ? d.tests
        .filter((t) => t && typeof t.input === "string" && typeof t.expected === "string")
        .map((t) => ({
          input: String(t.input),
          expected: String(t.expected),
          hidden: Boolean(t.hidden),
        }))
    : [];
  if (tests.length === 0) throw new Error("Harness generation produced no tests");

  return {
    slug,
    ioFormat: String(d.ioFormat ?? ""),
    tests,
    harness,
  };
}

export async function generateHarness(input: {
  slug: string;
  title: string;
  difficulty: string;
  statement: string;
  exampleTestcases: string;
  pythonSignature: string;
}): Promise<HarnessData> {
  const statement = toPlainText(input.statement).slice(0, 6000);

  const system = `You are a systems engineer who builds LeetCode-style automated judges.
You write execution harnesses that wrap a user's "class Solution" code, feed it input from stdin, and print the answer in LeetCode's canonical text format.
Your harnesses and test cases MUST be byte-accurate: the printed output of a CORRECT solution must exactly equal the test's "expected" string.
You always respond with a SINGLE valid JSON object and nothing else — no prose, no markdown fences.`;

  const user = `Build an in-app judge harness for this problem.

Title: ${input.title}
Difficulty: ${input.difficulty}
Official Python signature (the user's editor code will be a "class Solution" with exactly this method):
${input.pythonSignature || "(unknown — infer from the statement)"}

LeetCode example test cases (raw, each argument on its own line, arrays as JSON like [1,2,3]):
${input.exampleTestcases || "(none provided)"}

Problem statement:
${statement || "(Use your knowledge of this well-known problem by its title.)"}

Return JSON with EXACTLY this shape:
{
  "ioFormat": "One short human-readable line describing the stdin format and the stdout format.",
  "tests": [
    { "input": "<multi-line stdin>", "expected": "<exact stdout>" },
    { "input": "...", "expected": "...", "hidden": true }
  ],
  "harness": {
    "python": "<preamble>\\n\\n__USER_CODE__\\n\\n<driver that reads stdin, calls Solution, prints>",
    "javascript": "...__USER_CODE__...",
    "cpp": "...__USER_CODE__...",
    "java": "...__USER_CODE__..."
  }
}

STRICT REQUIREMENTS:
- The stdin format MUST match LeetCode's example format above: ONE argument per line, in the method's parameter order. Arrays are JSON (e.g. [1,2,3] or [[1,2],[3,4]]), strings are the raw text (no surrounding quotes) unless the value is genuinely a JSON string in LeetCode's examples, booleans are true/false, null is null.
- The harness's __USER_CODE__ placeholder marks where the user's "class Solution" is spliced in. It MUST appear exactly once in each language.
- The preamble (before __USER_CODE__) MUST include every import the user's Solution could need (Python: "from typing import List, Optional, Dict, Set, Tuple" and "import collections, heapq, math, functools, itertools, bisect"; C++: "#include <bits/stdc++.h>\\nusing namespace std;"; Java: "import java.util.*;"; JS: none).
- If the signature uses linked lists or trees, DEFINE the exact LeetCode helper types in the preamble (Python ListNode/TreeNode with val/next or val/left/right; C++ struct ListNode/TreeNode; Java class ListNode/TreeNode) so BOTH the user's Solution and the driver compile. The driver must build these structures from the JSON input and serialize results back to LeetCode's format (linked list -> [1,2,3]; tree -> level-order with nulls where LeetCode uses them).
- The driver reads ALL of stdin, parses each argument line, instantiates Solution, calls the method, and prints ONE line: the result in LeetCode canonical format (arrays printed as [1,2,3] with NO spaces after commas; booleans lowercase; strings raw; doubles with the precision LeetCode uses).
- Java: the public class MUST be named "Main" and contain "public static void main". Keep "class Solution" (non-public) from the user code — do not rename it.
- Provide 5–8 tests. Include ALL the LeetCode examples above first, then add edge cases. Each "expected" MUST be exactly what your own harness prints for a correct solution (same formatting, no trailing spaces).
- All four languages must agree on the SAME stdin format and the SAME output format so one set of tests works for every language.
- Output valid JSON: escape every newline as \\n and every quote inside code strings.`;

  const res = await callAI([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty AI response");

  const parsed = JSON.parse(extractJson(content));
  return validate(parsed, input.slug);
}
