// Route data for /problems/$slug: the statement is resolved before render so
// the page (and its <title>) is complete on the server, and client-side
// problem switches reuse the session cache.

import { PROBLEMS } from "@/data/problems";
import { getLeetProblem, type LeetProblem } from "@/lib/leetcode.functions";
import { statementCache } from "./cache";

export type ArenaData = {
  slug: string;
  remote: LeetProblem | null;
  error: string | null;
};

const SLUG_RE = /^[a-z0-9-]{1,120}$/;

export async function loadArenaData(slug: string): Promise<ArenaData> {
  if (PROBLEMS.some((p) => p.id === slug)) return { slug, remote: null, error: null };
  if (!SLUG_RE.test(slug)) return { slug, remote: null, error: "This problem doesn't exist." };
  const cached = statementCache.get(slug);
  if (cached) return { slug, remote: cached, error: null };
  try {
    const remote = await getLeetProblem({ data: { slug } });
    if (typeof window !== "undefined") statementCache.set(slug, remote);
    return { slug, remote, error: null };
  } catch {
    return { slug, remote: null, error: "Couldn't load this problem right now. Please try again." };
  }
}

export function prettyFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, n = 155): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

/** <title> and description for a problem page. */
export function arenaMeta(data: ArenaData | undefined): { title: string; description: string } {
  if (!data)
    return { title: "Problem — Ezvor", description: "Solve coding problems in the Ezvor arena." };
  const idx = PROBLEMS.findIndex((p) => p.id === data.slug);
  if (idx >= 0) {
    const p = PROBLEMS[idx];
    return {
      title: `${idx + 1}. ${p.title} — Ezvor`,
      description: clip(plain(p.description.replace(/`/g, ""))),
    };
  }
  if (data.remote) {
    const r = data.remote;
    return {
      title: `${r.frontendId ? `${r.frontendId}. ` : ""}${r.title} — Ezvor`,
      description: clip(`${r.difficulty}. ${plain(r.contentHtml)}`),
    };
  }
  return {
    title: `${prettyFromSlug(data.slug)} — Ezvor`,
    description: "Solve this coding problem in the Ezvor arena with a real judge and an AI coach.",
  };
}
