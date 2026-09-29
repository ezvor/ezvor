import { LANGUAGE_INFO } from "@/lib/judge/languages";
import type { SubmissionEntry } from "@/lib/local/store";
import { relativeTime } from "@/lib/progress/stats";
import { cn } from "@/lib/utils";

import { ProblemLink } from "./ProblemLink";

export function RecentSubmissions({
  submissions,
  limit = 10,
  now,
}: {
  submissions: SubmissionEntry[];
  limit?: number;
  /** Pass 0 before hydration to hide relative times. */
  now: number;
}) {
  if (!submissions.length) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
        No submissions yet. Your judged runs appear here.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border/50">
      {submissions.slice(0, limit).map((s) => {
        const ok = s.status === "Accepted";
        return (
          <li key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <ProblemLink slug={s.slug} className="block truncate font-medium hover:underline">
                {s.title}
              </ProblemLink>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {LANGUAGE_INFO[s.language]?.label ?? s.language}
                {s.runtimeMs != null && ok && <> · {Math.round(s.runtimeMs)} ms</>}
                {!ok && s.total > 0 && (
                  <>
                    {" "}
                    · {s.passed}/{s.total} tests
                  </>
                )}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn("text-xs font-medium", ok ? "text-success" : "text-destructive")}>
                {s.status}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {now ? relativeTime(s.at, now) : " "}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
