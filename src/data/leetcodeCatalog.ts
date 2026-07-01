// Full LeetCode problem catalog (all problems), served as a lazy-loaded public
// asset at /leetcode-catalog.json. Generated from LeetCode's public API +
// GraphQL, enriched with community company-tag data (187 companies).
import { PROBLEMS } from "@/data/problems";

export type LcDifficulty = "Easy" | "Medium" | "Hard";

export type LcProblem = {
  id: number;
  slug: string;
  title: string;
  difficulty: LcDifficulty;
  paid: boolean;
  acRate: number;
  tags: string[];
  companies: string[];
};

export type LcCatalog = {
  companies: string[];
  problems: LcProblem[];
  generatedAt: string;
};

/** Slugs we can actually run + judge locally in the Code Playground. */
export const SOLVABLE_SLUGS = new Set(PROBLEMS.map((p) => p.id));

let cache: LcCatalog | null = null;
let inflight: Promise<LcCatalog> | null = null;

export async function loadCatalog(): Promise<LcCatalog> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/leetcode-catalog.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load catalog (${r.status})`);
      return r.json() as Promise<LcCatalog>;
    })
    .then((data) => {
      cache = data;
      inflight = null;
      return data;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  return inflight;
}

/** Prettify a topic tag slug, e.g. "hash-table" -> "Hash Table". */
export function prettyTag(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
