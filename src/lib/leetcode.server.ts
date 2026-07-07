import sanitizeHtmlLib from "sanitize-html";

import type { LangKey } from "./judge.server";

export type LeetProblem = {
  slug: string;
  frontendId: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  contentHtml: string;
  hints: string[];
  tags: { name: string; slug: string }[];
  snippets: Partial<Record<LangKey, string>>;
  exampleTestcases: string;
};

/** LeetCode `langSlug` -> our editor LangKey. */
const LANG_SLUG_MAP: Record<string, LangKey> = {
  python3: "python",
  python: "python",
  cpp: "cpp",
  c: "c",
  java: "java",
  javascript: "javascript",
  typescript: "typescript",
  golang: "go",
  rust: "rust",
};

/**
 * Sanitize third-party (LeetCode) problem HTML with a real allowlist-based
 * parser before it is cached and rendered. A regex approach is bypassable, so
 * we use `sanitize-html` with a strict tag/attribute allowlist and drop any
 * dangerous URL schemes (javascript:, data:, vbscript:) from links/images.
 */
function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: [
      "p", "br", "hr", "b", "strong", "i", "em", "u", "s", "sub", "sup", "small",
      "code", "pre", "kbd", "samp", "var", "span", "div", "blockquote",
      "ul", "ol", "li", "dl", "dt", "dd",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
      "h1", "h2", "h3", "h4", "h5", "h6", "a", "img", "figure", "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
    },
  });
}


const QUERY = `query q($slug: String!) {
  question(titleSlug: $slug) {
    questionFrontendId
    title
    difficulty
    content
    exampleTestcases
    hints
    topicTags { name slug }
    codeSnippets { langSlug code }
  }
}`;

/** Fetch a full problem statement + official starter code from LeetCode. */
export async function fetchLeetProblem(slug: string): Promise<LeetProblem> {
  const res = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      referer: `https://leetcode.com/problems/${slug}/`,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
    body: JSON.stringify({ query: QUERY, variables: { slug } }),
  });

  if (!res.ok) throw new Error(`LeetCode responded ${res.status}`);
  const json = (await res.json()) as {
    data?: { question?: Record<string, unknown> | null };
  };
  const q = json.data?.question;
  if (!q) throw new Error("Problem not found");

  const snippets: Partial<Record<LangKey, string>> = {};
  for (const s of (q.codeSnippets as { langSlug: string; code: string }[] | null) ?? []) {
    const key = LANG_SLUG_MAP[s.langSlug];
    // Prefer python3 over python2 for the "python" slot.
    if (!key) continue;
    if (key === "python" && s.langSlug === "python") continue;
    snippets[key] = s.code;
  }

  const difficulty = (q.difficulty as string) as LeetProblem["difficulty"];

  return {
    slug,
    frontendId: String(q.questionFrontendId ?? ""),
    title: String(q.title ?? slug),
    difficulty: difficulty === "Easy" || difficulty === "Hard" ? difficulty : "Medium",
    contentHtml: sanitizeHtml(String(q.content ?? "")),
    hints: ((q.hints as string[] | null) ?? []).map(sanitizeHtml),
    tags: ((q.topicTags as { name: string; slug: string }[] | null) ?? []).map((t) => ({
      name: t.name,
      slug: t.slug,
    })),
    snippets,
    exampleTestcases: String(q.exampleTestcases ?? ""),
  };
}
