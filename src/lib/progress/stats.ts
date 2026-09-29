// Pure, derived progress statistics. Inputs are the local-first collections
// from `@/lib/local/store` plus (optionally) the catalog index.
import type { LcDifficulty, LcProblem } from "@/data/leetcodeCatalog";
import { listSlugs, STUDY_LISTS, type StudyList } from "@/data/lists";
import type { ReviewEntry, SolvedEntry, SubmissionEntry } from "@/lib/local/store";

export const DIFFICULTIES: LcDifficulty[] = ["Easy", "Medium", "Hard"];

export type DifficultyCounts = Record<LcDifficulty, number> & { total: number };

export function emptyCounts(): DifficultyCounts {
  return { Easy: 0, Medium: 0, Hard: 0, total: 0 };
}

export function catalogTotals(problems: LcProblem[] | undefined): DifficultyCounts {
  const c = emptyCounts();
  for (const p of problems ?? []) {
    c[p.difficulty]++;
    c.total++;
  }
  return c;
}

/** Solved counts by difficulty (catalog difficulty wins over the stored one). */
export function solvedCounts(
  solved: Record<string, SolvedEntry>,
  bySlug?: Map<string, LcProblem>,
): DifficultyCounts {
  const c = emptyCounts();
  for (const entry of Object.values(solved)) {
    const d = bySlug?.get(entry.slug)?.difficulty ?? entry.difficulty;
    if (d in c) c[d]++;
    c.total++;
  }
  return c;
}

/** Slugs with at least one submission that were never accepted. */
export function attemptedSlugs(
  submissions: SubmissionEntry[],
  solved: Record<string, SolvedEntry>,
): Set<string> {
  const out = new Set<string>();
  for (const s of submissions) if (!solved[s.slug]) out.add(s.slug);
  return out;
}

export type ProblemStatus = "solved" | "attempted" | "todo";

export function statusOf(
  slug: string,
  solved: Record<string, SolvedEntry>,
  attempted: Set<string>,
): ProblemStatus {
  if (solved[slug]) return "solved";
  if (attempted.has(slug)) return "attempted";
  return "todo";
}

/* ------------------------------------------------------------ lists */

export type SectionProgress = { title: string; done: number; total: number };

export type ListProgress = {
  list: StudyList;
  done: number;
  total: number;
  pct: number;
  sections: SectionProgress[];
  /** First unsolved problem in list order (undefined when complete). */
  next?: string;
  /** Latest solve time of any problem in this list. */
  lastSolvedAt: number;
};

export function listProgress(list: StudyList, solved: Record<string, SolvedEntry>): ListProgress {
  let done = 0;
  let total = 0;
  let next: string | undefined;
  let lastSolvedAt = 0;
  const sections = list.sections.map((s) => {
    let d = 0;
    for (const slug of s.slugs) {
      const e = solved[slug];
      if (e) {
        d++;
        lastSolvedAt = Math.max(lastSolvedAt, e.solvedAt);
      } else if (!next) next = slug;
    }
    done += d;
    total += s.slugs.length;
    return { title: s.title, done: d, total: s.slugs.length };
  });
  return { list, done, total, pct: total ? done / total : 0, sections, next, lastSolvedAt };
}

/**
 * The list the learner is most likely working through: the one they solved
 * something from most recently (ties broken by completion), else the default.
 */
export function activeList(solved: Record<string, SolvedEntry>, fallbackId: string): ListProgress {
  const all = STUDY_LISTS.map((l) => listProgress(l, solved));
  const started = all.filter((p) => p.done > 0 && p.done < p.total);
  if (started.length) {
    return started.sort((a, b) => b.lastSolvedAt - a.lastSolvedAt || b.pct - a.pct)[0];
  }
  return (
    all.find((p) => p.list.id === fallbackId && p.done < p.total) ??
    all.find((p) => p.done < p.total) ??
    all[0]
  );
}

/** Every slug that appears in any curated list, with the lists that contain it. */
export function listMembership(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const l of STUDY_LISTS) {
    for (const slug of listSlugs(l)) {
      const arr = m.get(slug);
      if (arr) arr.push(l.id);
      else m.set(slug, [l.id]);
    }
  }
  return m;
}

/* ------------------------------------------------------------ topics */

export type TopicStat = { tag: string; solved: number; total: number };

/** Solved counts per catalog topic tag, most practised first. */
export function topicMastery(
  solved: Record<string, SolvedEntry>,
  problems: LcProblem[] | undefined,
  bySlug: Map<string, LcProblem>,
): TopicStat[] {
  const totals = new Map<string, number>();
  for (const p of problems ?? []) for (const t of p.tags) totals.set(t, (totals.get(t) ?? 0) + 1);
  const counts = new Map<string, number>();
  for (const slug of Object.keys(solved)) {
    for (const t of bySlug.get(slug)?.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, n]) => ({ tag, solved: n, total: totals.get(tag) ?? n }))
    .sort((a, b) => b.solved - a.solved || a.tag.localeCompare(b.tag));
}

/* ------------------------------------------------------------ reviews */

export function dueReviews(review: Record<string, ReviewEntry>, now = Date.now()): ReviewEntry[] {
  return Object.values(review)
    .filter((r) => r.due <= now)
    .sort((a, b) => a.due - b.due);
}

export function upcomingReviews(
  review: Record<string, ReviewEntry>,
  now = Date.now(),
): ReviewEntry[] {
  return Object.values(review)
    .filter((r) => r.due > now)
    .sort((a, b) => a.due - b.due);
}

/**
 * Interval (days) a grade would schedule next — mirrors `gradeReview` in the
 * store so the buttons can show "Good · 8d" before you press them.
 */
export function previewInterval(card: ReviewEntry, grade: 0 | 1 | 2 | 3): number {
  if (grade === 0) return 1;
  const reps = card.reps + 1;
  const ease = Math.max(1.3, card.ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0));
  return reps === 1 ? 3 : Math.round(card.intervalDays * (grade === 1 ? 1.2 : ease));
}

export function formatDays(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

/* ------------------------------------------------------------ formatting */

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = ts - now;
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60_000, "second"],
    [3_600_000, "minute"],
    [86_400_000, "hour"],
    [7 * 86_400_000, "day"],
    [30 * 86_400_000, "week"],
    [365 * 86_400_000, "month"],
    [Infinity, "year"],
  ];
  const size: Record<string, number> = {
    second: 1000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 7 * 86_400_000,
    month: 30 * 86_400_000,
    year: 365 * 86_400_000,
  };
  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [limit, unit] of units) {
    if (abs < limit) return fmt.format(Math.round(diff / size[unit]), unit);
  }
  return fmt.format(Math.round(diff / size.year), "year");
}
