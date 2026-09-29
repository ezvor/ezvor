import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import type { LcProblem } from "@/data/leetcodeCatalog";
import { listSlugs, type StudyList } from "@/data/lists";
import type { SolvedEntry } from "@/lib/local/store";
import { listProgress } from "@/lib/progress/stats";
import { cn } from "@/lib/utils";

import { DifficultySplit } from "./Difficulty";
import { ProgressRing } from "./ProgressRing";

export function ListCard({
  list,
  solved,
  bySlug,
  className,
}: {
  list: StudyList;
  solved: Record<string, SolvedEntry>;
  bySlug: Map<string, LcProblem>;
  className?: string;
}) {
  const p = listProgress(list, solved);
  const split = { Easy: 0, Medium: 0, Hard: 0 };
  for (const s of listSlugs(list)) {
    const d = bySlug.get(s)?.difficulty;
    if (d) split[d]++;
  }
  const complete = p.done === p.total;

  return (
    <Link
      to="/lists/$listId"
      params={{ listId: list.id }}
      className={cn(
        "group flex h-full flex-col rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{list.name}</h2>
          {list.source && <p className="text-xs text-muted-foreground">by {list.source}</p>}
        </div>
        <ProgressRing
          value={p.pct}
          size={52}
          stroke={4}
          color={complete ? "var(--success)" : "var(--foreground)"}
          label={`${p.done} of ${p.total} solved`}
        >
          <span className="text-[11px] font-semibold tabular-nums">{Math.round(p.pct * 100)}%</span>
        </ProgressRing>
      </div>

      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{list.description}</p>

      <div className="mt-auto space-y-2 pt-5">
        <DifficultySplit easy={split.Easy} medium={split.Medium} hard={split.Hard} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {bySlug.size ? (
              <>
                <span className="text-success">{split.Easy}</span> ·{" "}
                <span className="text-warning">{split.Medium}</span> ·{" "}
                <span className="text-destructive">{split.Hard}</span>
              </>
            ) : (
              <>{list.sections.length} sections</>
            )}
          </span>
          <span className="tabular-nums">
            {p.done}/{p.total} solved
          </span>
        </div>
        <span className="flex items-center gap-1 pt-1 text-sm font-medium">
          {p.done === 0 ? "Start list" : complete ? "Review list" : "Continue"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
