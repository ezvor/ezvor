import { CalendarDays, CheckCircle2, ArrowRight } from "lucide-react";

import { prettyTag } from "@/data/leetcodeCatalog";
import { useCollection } from "@/lib/local/store";
import { useCatalog } from "@/lib/progress/catalog";
import { acceptedOnUtcDay, dailyChallenge, msUntilNextDaily } from "@/lib/progress/daily";
import { useHydrated } from "@/lib/progress/hydrated";
import { cn } from "@/lib/utils";

import { DifficultyLabel } from "./Difficulty";
import { ProblemLink } from "./ProblemLink";

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function DailyChallengeCard({ className }: { className?: string }) {
  const { catalog } = useCatalog();
  const submissions = useCollection("submissions");
  const solved = useCollection("solved");
  const hydrated = useHydrated();

  const daily = hydrated ? dailyChallenge(catalog?.problems) : null;
  const doneToday = daily ? acceptedOnUtcDay(submissions, daily.problem.slug) : false;
  const solvedBefore = daily ? Boolean(solved[daily.problem.slug]) && !doneToday : false;

  return (
    <section
      aria-labelledby="daily-heading"
      className={cn(
        "flex flex-col rounded-2xl border border-border/60 bg-card p-5",
        doneToday && "border-success/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="daily-heading"
          className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Daily challenge
        </h2>
        {daily && (
          <span className="text-[11px] text-muted-foreground">
            {new Date(`${daily.date}T00:00:00Z`).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}{" "}
            UTC
          </span>
        )}
      </div>

      {!daily ? (
        <div className="mt-4 space-y-2" aria-busy>
          <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-9 w-28 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        <>
          <ProblemLink
            slug={daily.problem.slug}
            className="mt-3 font-display text-lg font-semibold leading-snug hover:underline"
          >
            {daily.problem.id}. {daily.problem.title}
          </ProblemLink>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <DifficultyLabel difficulty={daily.difficulty} />
            <span>{daily.problem.acRate}% acceptance</span>
            {daily.problem.tags.slice(0, 2).map((t) => (
              <span key={t}>{prettyTag(t)}</span>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
            {doneToday ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" /> Solved today
              </span>
            ) : (
              <ProblemLink
                slug={daily.problem.slug}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {solvedBefore ? "Solve again" : "Solve"} <ArrowRight className="h-4 w-4" />
              </ProblemLink>
            )}
            <span className="text-[11px] text-muted-foreground">
              Next in {formatCountdown(msUntilNextDaily())}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
