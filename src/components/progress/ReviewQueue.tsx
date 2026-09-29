import { ExternalLink, Repeat } from "lucide-react";

import { gradeReview, useCollection } from "@/lib/local/store";
import { useHydrated } from "@/lib/progress/hydrated";
import {
  dueReviews,
  formatDays,
  previewInterval,
  relativeTime,
  upcomingReviews,
} from "@/lib/progress/stats";
import { cn } from "@/lib/utils";

import { DifficultyLabel } from "./Difficulty";
import { ProblemLink } from "./ProblemLink";

const GRADES = [
  { grade: 0, label: "Forgot", cls: "hover:border-destructive/60 hover:text-destructive" },
  { grade: 1, label: "Hard", cls: "hover:border-warning/60 hover:text-warning" },
  { grade: 2, label: "Good", cls: "hover:border-foreground/40" },
  { grade: 3, label: "Easy", cls: "hover:border-success/60 hover:text-success" },
] as const;

/**
 * Spaced-repetition queue. Every accepted problem is scheduled for review;
 * grading re-solves you did from memory pushes the next review further out.
 */
export function ReviewQueue({
  limit = 8,
  className,
  id = "review",
}: {
  limit?: number;
  className?: string;
  id?: string;
}) {
  const review = useCollection("review");
  const hydrated = useHydrated();
  const now = hydrated ? Date.now() : 0;
  const due = hydrated ? dueReviews(review, now) : [];
  const upcoming = hydrated ? upcomingReviews(review, now).slice(0, 3) : [];
  const total = Object.keys(review).length;

  return (
    <section
      id={id}
      aria-labelledby="review-heading"
      className={cn("scroll-mt-4 rounded-2xl border border-border/60 bg-card", className)}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <h2
            id="review-heading"
            className="flex items-center gap-2 font-display text-base font-semibold"
          >
            <Repeat className="h-4 w-4 text-muted-foreground" />
            Review queue
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Re-solve from memory, then grade how it went.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
            due.length ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
          )}
        >
          {due.length} due
        </span>
      </header>

      {total === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Problems you solve are scheduled here for review, starting three days later.
        </p>
      ) : due.length === 0 ? (
        <div className="px-5 py-6 text-sm">
          <p className="text-muted-foreground">Nothing due. You are up to date.</p>
          {upcoming.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              {upcoming.map((r) => (
                <li key={r.slug} className="flex items-center justify-between gap-3">
                  <span className="truncate">{r.title}</span>
                  <span className="shrink-0 tabular-nums">{relativeTime(r.due, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {due.slice(0, limit).map((r) => (
            <li
              key={r.slug}
              className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <ProblemLink
                  slug={r.slug}
                  className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-medium hover:underline"
                >
                  <span className="truncate">{r.title}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                </ProblemLink>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <DifficultyLabel difficulty={r.difficulty} />
                  <span>due {relativeTime(r.due, now)}</span>
                  {r.reps > 0 && <span>{r.reps} reviews</span>}
                </p>
              </div>
              <div
                className="grid shrink-0 grid-cols-4 gap-1.5"
                role="group"
                aria-label={`Grade ${r.title}`}
              >
                {GRADES.map((g) => (
                  <button
                    key={g.grade}
                    type="button"
                    onClick={() => gradeReview(r.slug, g.grade)}
                    className={cn(
                      "flex flex-col items-center rounded-lg border border-border/60 px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      g.cls,
                    )}
                  >
                    <span className="font-medium">{g.label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {formatDays(previewInterval(r, g.grade))}
                    </span>
                  </button>
                ))}
              </div>
            </li>
          ))}
          {due.length > limit && (
            <li className="px-5 py-2.5 text-xs text-muted-foreground">
              +{due.length - limit} more due
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
