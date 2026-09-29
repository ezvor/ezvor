// Daily challenge: one problem per UTC date, identical for every visitor.
//
// Difficulty ramps through the week (Mon-Tue Easy, Wed-Fri Medium, Sat Hard,
// Sun Medium). The pick is a hash of the date into the free (non-premium)
// problems of that difficulty, ordered by problem id.
import type { LcDifficulty, LcProblem } from "@/data/leetcodeCatalog";
import type { SubmissionEntry } from "@/lib/local/store";

const DAY_MS = 86_400_000;

/** UTC calendar date, "YYYY-MM-DD". */
export function utcDayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Start of the UTC day containing `ts`. */
export function utcDayStart(ts = Date.now()): number {
  return Math.floor(ts / DAY_MS) * DAY_MS;
}

/** Index 0 = Sunday … 6 = Saturday. */
const RAMP: LcDifficulty[] = ["Medium", "Easy", "Easy", "Medium", "Medium", "Medium", "Hard"];

export function dailyDifficulty(ts = Date.now()): LcDifficulty {
  return RAMP[new Date(ts).getUTCDay()];
}

/** FNV-1a 32-bit hash — small, fast and stable across runtimes. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const poolCache = new WeakMap<LcProblem[], Record<LcDifficulty, LcProblem[]>>();

function pools(problems: LcProblem[]): Record<LcDifficulty, LcProblem[]> {
  let p = poolCache.get(problems);
  if (!p) {
    p = { Easy: [], Medium: [], Hard: [] };
    // Skip premium statements and near-impossible outliers (<15% acceptance).
    for (const x of problems) if (!x.paid && x.acRate >= 15) p[x.difficulty].push(x);
    for (const d of Object.keys(p) as LcDifficulty[]) p[d].sort((a, b) => a.id - b.id);
    poolCache.set(problems, p);
  }
  return p;
}

export type DailyChallenge = { date: string; difficulty: LcDifficulty; problem: LcProblem };

export function dailyChallenge(
  problems: LcProblem[] | undefined,
  ts = Date.now(),
): DailyChallenge | null {
  if (!problems?.length) return null;
  const difficulty = dailyDifficulty(ts);
  const pool = pools(problems)[difficulty];
  if (!pool.length) return null;
  const date = utcDayKey(ts);
  return { date, difficulty, problem: pool[fnv1a(`ezvor-daily:${date}`) % pool.length] };
}

/** Did the learner get an Accepted verdict on `slug` during the given UTC day? */
export function acceptedOnUtcDay(
  submissions: SubmissionEntry[],
  slug: string,
  ts = Date.now(),
): boolean {
  const start = utcDayStart(ts);
  const end = start + DAY_MS;
  return submissions.some(
    (s) => s.slug === slug && s.status === "Accepted" && s.at >= start && s.at < end,
  );
}

/** Number of distinct UTC days on which the learner solved that day's challenge. */
export function dailyChallengesCompleted(
  submissions: SubmissionEntry[],
  problems: LcProblem[] | undefined,
): number {
  if (!problems?.length) return 0;
  const days = new Set<string>();
  for (const s of submissions) {
    if (s.status !== "Accepted") continue;
    const key = utcDayKey(s.at);
    if (days.has(key)) continue;
    if (dailyChallenge(problems, s.at)?.problem.slug === s.slug) days.add(key);
  }
  return days.size;
}

/** Milliseconds until the next UTC midnight (when the challenge rotates). */
export function msUntilNextDaily(ts = Date.now()): number {
  return utcDayStart(ts) + DAY_MS - ts;
}
