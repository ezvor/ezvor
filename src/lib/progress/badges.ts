// Achievements computed purely from local data. No server, no grinding loops:
// each badge marks a real milestone and reports progress toward it.
import type { LcProblem } from "@/data/leetcodeCatalog";
import { STUDY_LISTS } from "@/data/lists";
import type { Collections } from "@/lib/local/store";
import { streakStats } from "@/lib/local/store";

import { dailyChallengesCompleted } from "./daily";
import { listProgress, solvedCounts } from "./stats";

export type BadgeIcon =
  "first" | "count" | "streak" | "list" | "hard" | "review" | "language" | "daily";

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  value: number;
  target: number;
  earned: boolean;
  /** Higher tiers look more prominent. */
  tier: 1 | 2 | 3;
};

type Input = Pick<Collections, "solved" | "submissions" | "activity" | "review">;

function badge(
  id: string,
  name: string,
  description: string,
  icon: BadgeIcon,
  value: number,
  target: number,
  tier: 1 | 2 | 3 = 1,
): Badge {
  return {
    id,
    name,
    description,
    icon,
    value: Math.min(value, target),
    target,
    earned: value >= target,
    tier,
  };
}

export function computeBadges(data: Input, problems?: LcProblem[]): Badge[] {
  const bySlug = problems ? new Map(problems.map((p) => [p.slug, p])) : undefined;
  const counts = solvedCounts(data.solved, bySlug);
  const streak = streakStats(data.activity);
  const reviewed = Object.values(data.review).filter((r) => r.reps > 0).length;
  const languages = new Set(Object.values(data.solved).map((s) => s.language)).size;
  const daily = dailyChallengesCompleted(data.submissions, problems);

  const out: Badge[] = [
    badge(
      "first-solve",
      "First Accepted",
      "Get your first problem accepted.",
      "first",
      counts.total,
      1,
    ),
    badge("solved-10", "Warming Up", "Solve 10 problems.", "count", counts.total, 10),
    badge("solved-50", "Consistent", "Solve 50 problems.", "count", counts.total, 50, 2),
    badge("solved-100", "Centurion", "Solve 100 problems.", "count", counts.total, 100, 2),
    badge("solved-250", "Deep Bench", "Solve 250 problems.", "count", counts.total, 250, 3),
    badge("streak-7", "One Week", "Practise 7 days in a row.", "streak", streak.longest, 7),
    badge("streak-30", "One Month", "Practise 30 days in a row.", "streak", streak.longest, 30, 2),
    badge(
      "streak-100",
      "Habit Formed",
      "Practise 100 days in a row.",
      "streak",
      streak.longest,
      100,
      3,
    ),
    badge("hard-10", "Hard Hitter", "Solve 10 Hard problems.", "hard", counts.Hard, 10, 2),
    badge("daily-1", "Daily Driver", "Solve a daily challenge on the day.", "daily", daily, 1),
    badge("daily-10", "Regular", "Solve 10 daily challenges.", "daily", daily, 10, 2),
    badge(
      "review-10",
      "Spaced Out",
      "Complete 10 spaced-repetition reviews.",
      "review",
      reviewed,
      10,
    ),
    badge(
      "polyglot",
      "Polyglot",
      "Solve problems in 3 different languages.",
      "language",
      languages,
      3,
    ),
  ];

  for (const list of STUDY_LISTS) {
    const p = listProgress(list, data.solved);
    out.push(
      badge(
        `list-${list.id}`,
        `${list.name} Complete`,
        `Solve every problem in ${list.name}.`,
        "list",
        p.done,
        p.total,
        list.id === "neetcode-150" || list.id === "top-interview-150" ? 3 : 2,
      ),
    );
  }
  return out;
}
