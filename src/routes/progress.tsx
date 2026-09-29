import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Award, Flame, ListChecks, Tags, TimerReset } from "lucide-react";

import { ActivityHeatmap } from "@/components/progress/ActivityHeatmap";
import { BadgeGrid } from "@/components/progress/BadgeGrid";
import { DailyChallengeCard } from "@/components/progress/DailyChallengeCard";
import { DIFF_BG, DIFF_TEXT } from "@/components/progress/Difficulty";
import { DifficultyRing } from "@/components/progress/ProgressRing";
import { RecentSubmissions } from "@/components/progress/RecentSubmissions";
import { ReviewQueue } from "@/components/progress/ReviewQueue";
import { prettyTag } from "@/data/leetcodeCatalog";
import { STUDY_LISTS } from "@/data/lists";
import { streakStats, useCollection } from "@/lib/local/store";
import { computeBadges } from "@/lib/progress/badges";
import { useCatalog } from "@/lib/progress/catalog";
import { useHydrated } from "@/lib/progress/hydrated";
import {
  catalogTotals,
  DIFFICULTIES,
  listProgress,
  solvedCounts,
  topicMastery,
} from "@/lib/progress/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progress — Ezvor" },
      {
        name: "description",
        content:
          "Your solved problems by difficulty, a year of activity, streaks, topic coverage, spaced-repetition reviews and achievements.",
      },
    ],
  }),
  component: ProgressPage,
});

function Card({
  title,
  icon: Icon,
  action,
  children,
  className,
  id,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = `${id ?? title.toLowerCase().replace(/\W+/g, "-")}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-4 rounded-2xl border border-border/60 bg-card", className)}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <h2 id={headingId} className="flex items-center gap-2 font-display text-base font-semibold">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function ProgressPage() {
  const solved = useCollection("solved");
  const submissions = useCollection("submissions");
  const activity = useCollection("activity");
  const review = useCollection("review");
  const { catalog, bySlug } = useCatalog();
  const hydrated = useHydrated();
  const now = hydrated ? Date.now() : 0;

  const totals = useMemo(() => catalogTotals(catalog?.problems), [catalog]);
  const counts = useMemo(() => solvedCounts(solved, bySlug), [solved, bySlug]);
  const streak = useMemo(() => streakStats(activity), [activity]);
  const topics = useMemo(
    () => topicMastery(solved, catalog?.problems, bySlug).slice(0, 12),
    [solved, catalog, bySlug],
  );
  const lists = useMemo(() => STUDY_LISTS.map((l) => listProgress(l, solved)), [solved]);
  const badges = useMemo(
    () => computeBadges({ solved, submissions, activity, review }, catalog?.problems),
    [solved, submissions, activity, review, catalog],
  );
  const earned = badges.filter((b) => b.earned).length;
  const accepted = submissions.filter((s) => s.status === "Accepted").length;
  const acceptance = submissions.length ? Math.round((accepted / submissions.length) * 100) : null;

  return (
    <div className="pb-16">
      <div className="border-b border-border/60 bg-gradient-hero">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Progress</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Everything here is computed from your activity in this browser.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pt-6 sm:px-8">
        {/* Summary row */}
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr_1fr]">
          <section
            aria-labelledby="solved-heading"
            className="flex flex-col items-center gap-6 rounded-2xl border border-border/60 bg-card p-5 sm:flex-row"
          >
            <h2 id="solved-heading" className="sr-only">
              Solved problems
            </h2>
            <DifficultyRing
              solved={counts}
              totals={catalog ? totals : { Easy: 1, Medium: 2, Hard: 1 }}
            >
              <span className="font-display text-3xl font-bold tabular-nums">{counts.total}</span>
              <span className="text-[11px] text-muted-foreground">
                {catalog ? `of ${totals.total.toLocaleString()}` : "solved"}
              </span>
            </DifficultyRing>
            <div className="w-full flex-1 space-y-3">
              {DIFFICULTIES.map((d) => (
                <div key={d}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className={cn("font-medium", DIFF_TEXT[d])}>{d}</span>
                    <span className="tabular-nums">
                      {counts[d]}
                      <span className="text-xs text-muted-foreground">
                        {catalog ? ` / ${totals[d].toLocaleString()}` : ""}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", DIFF_BG[d])}
                      style={{
                        width: totals[d] ? `${Math.min(100, (counts[d] / totals[d]) * 100)}%` : 0,
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                {submissions.length} submissions
                {acceptance != null && <> · {acceptance}% accepted</>}
              </p>
            </div>
          </section>

          <section
            aria-labelledby="streak-heading"
            className="rounded-2xl border border-border/60 bg-card p-5"
          >
            <h2
              id="streak-heading"
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              <Flame className="h-3.5 w-3.5" /> Streak
            </h2>
            <p className="mt-3 font-display text-4xl font-bold tabular-nums">
              {streak.current}
              <span className="ml-1.5 text-base font-normal text-muted-foreground">
                day{streak.current === 1 ? "" : "s"}
              </span>
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Longest", streak.longest],
                ["Active days", streak.activeDays],
                ["Today", streak.today],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/50 px-2 py-2">
                  <dd className="font-display text-lg font-semibold tabular-nums">{value}</dd>
                  <dt className="text-[10px] text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {streak.today > 0
                ? "You practised today."
                : streak.current > 0
                  ? "Submit something today to keep the streak."
                  : "Any judged submission starts a streak."}
            </p>
          </section>

          <DailyChallengeCard />
        </div>

        <Card title="Activity" icon={TimerReset}>
          <div className="p-5">
            {hydrated ? (
              <ActivityHeatmap activity={activity} />
            ) : (
              <div className="h-[150px] animate-pulse rounded-lg bg-muted/40" aria-hidden />
            )}
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <ReviewQueue className="lg:row-span-2" limit={6} />

          <Card title="Topics" icon={Tags}>
            {topics.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Topic coverage appears once you solve problems.
              </p>
            ) : (
              <ul className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
                {topics.map((t) => (
                  <li key={t.tag}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <Link
                        to="/problems"
                        search={{ topic: t.tag }}
                        className="truncate font-medium hover:underline"
                        title={`Browse ${prettyTag(t.tag)} problems`}
                      >
                        {prettyTag(t.tag)}
                      </Link>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {t.solved}
                        <span className="opacity-60"> / {t.total}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/60"
                        style={{
                          width: `${Math.max(3, (t.solved / Math.max(1, t.total)) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Study lists"
            icon={ListChecks}
            action={
              <Link to="/lists" className="text-xs text-muted-foreground hover:text-foreground">
                All lists
              </Link>
            }
          >
            <ul className="divide-y divide-border/50">
              {lists.map((p) => (
                <li key={p.list.id}>
                  <Link
                    to="/lists/$listId"
                    params={{ listId: p.list.id }}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/20"
                  >
                    <span className="w-36 shrink-0 truncate text-sm font-medium">
                      {p.list.name}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          p.done === p.total ? "bg-success" : "bg-foreground/60",
                        )}
                        style={{ width: `${p.pct * 100}%` }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {p.done}/{p.total}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <Card title="Recent submissions">
            <RecentSubmissions submissions={submissions} now={now} limit={10} />
          </Card>
          <Card
            title="Achievements"
            icon={Award}
            action={
              <span className="text-xs tabular-nums text-muted-foreground">
                {earned}/{badges.length}
              </span>
            }
          >
            <div className="p-4">
              <BadgeGrid badges={badges} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
