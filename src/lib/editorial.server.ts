// Server-only: generate a LeetCode/NeetCode-style editorial + fully worked,
// multi-language solutions for a problem, using the AI provider layer.
//
// Output is a strict JSON structure that the client renders in the Editorial
// and Solutions tabs. Results are cached per-slug in `problem_solutions` so
// repeat visits are instant and consistent.

import { callAI } from "./ai.server";

export type ApproachTag = "brute" | "better" | "optimal";

export type Approach = {
  /** e.g. "Brute Force", "Two Pointers (Optimal)" */
  name: string;
  tag: ApproachTag;
  /** 1–3 sentence plain-language explanation of the idea. */
  summary: string;
  /** Ordered, concrete steps of the algorithm. */
  steps: string[];
  time: string;
  space: string;
  /** langKey -> full, compilable solution code. Keys: cpp, python, java, javascript. */
  code: Record<string, string>;
};

export type EditorialData = {
  slug: string;
  title: string;
  overview: string;
  intuition: string;
  hints: string[];
  /** Ordered from brute force to optimal (2–3 entries). */
  approaches: Approach[];
};

const LANGS = ["cpp", "python", "java", "javascript"] as const;

/** Strip HTML tags/entities to plain text for the prompt. */
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

/** Pull the first balanced JSON object out of an AI response. */
function extractJson(raw: string): string {
  let s = raw.trim();
  // Strip ```json ... ``` fences if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in AI response");
  return s.slice(start, end + 1);
}

function validate(data: unknown, slug: string, title: string): EditorialData {
  const d = data as Partial<EditorialData>;
  if (!d || !Array.isArray(d.approaches) || d.approaches.length === 0) {
    throw new Error("Editorial missing approaches");
  }
  const approaches: Approach[] = d.approaches.map((a) => {
    const code: Record<string, string> = {};
    for (const l of LANGS) {
      const v = (a.code as Record<string, string> | undefined)?.[l];
      if (typeof v === "string" && v.trim()) code[l] = v;
    }
    const tag: ApproachTag =
      a.tag === "brute" || a.tag === "better" || a.tag === "optimal" ? a.tag : "optimal";
    return {
      name: String(a.name ?? "Approach"),
      tag,
      summary: String(a.summary ?? ""),
      steps: Array.isArray(a.steps) ? a.steps.map(String).filter(Boolean) : [],
      time: String(a.time ?? "—"),
      space: String(a.space ?? "—"),
      code,
    };
  });
  return {
    slug,
    title,
    overview: String(d.overview ?? ""),
    intuition: String(d.intuition ?? ""),
    hints: Array.isArray(d.hints) ? d.hints.map(String).filter(Boolean) : [],
    approaches,
  };
}

export async function generateEditorial(input: {
  slug: string;
  title: string;
  difficulty: string;
  statement: string;
}): Promise<EditorialData> {
  const statement = toPlainText(input.statement).slice(0, 6000);

  const system = `You are a world-class competitive-programming coach who writes LeetCode/NeetCode-quality editorials.
You produce ACCURATE, fully working, idiomatic solutions that compile and pass all tests.
You always respond with a SINGLE valid JSON object and nothing else — no prose, no markdown fences.`;

  const user = `Write a complete editorial for this problem.

Title: ${input.title}
Difficulty: ${input.difficulty}
Statement:
${statement || "(No statement text was provided — use your knowledge of this well-known problem by its title.)"}

Return JSON with EXACTLY this shape:
{
  "overview": "1-2 sentence summary of what the problem asks.",
  "intuition": "2-4 sentences building intuition for how to think about it.",
  "hints": ["progressive hint 1", "hint 2", "hint 3"],
  "approaches": [
    {
      "name": "Brute Force",
      "tag": "brute",
      "summary": "short idea",
      "steps": ["step 1", "step 2", "..."],
      "time": "O(...)",
      "space": "O(...)",
      "code": { "cpp": "...", "python": "...", "java": "...", "javascript": "..." }
    },
    {
      "name": "Optimal",
      "tag": "optimal",
      "summary": "short idea",
      "steps": ["..."],
      "time": "O(...)",
      "space": "O(...)",
      "code": { "cpp": "...", "python": "...", "java": "...", "javascript": "..." }
    }
  ]
}

Requirements:
- Provide 2 or 3 approaches ordered from brute force to optimal. If a "better" intermediate approach exists, add it with tag "better". If the problem has essentially only one reasonable solution, still give a naive version and the clean optimal version.
- For EVERY approach, provide COMPLETE, COMPILABLE solutions in all four languages: cpp, python, java, javascript.
- Use the exact LeetCode class/function signature (e.g. C++/Java "class Solution { ... }", Python "class Solution:", JavaScript standalone function) so the code can be pasted into LeetCode and run.
- Code must be correct and handle edge cases. Include necessary includes/imports for C++ and Java.
- Keep explanations concise but genuinely helpful. Use plain text (no markdown) inside string values.
- Escape all newlines and quotes so the JSON is valid.`;

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
  return validate(parsed, input.slug, input.title);
}
