import {
  CalendarCheck,
  CircleCheck,
  Flame,
  Languages,
  ListChecks,
  Mountain,
  Repeat,
  Target,
  type LucideIcon,
} from "lucide-react";

import type { Badge, BadgeIcon } from "@/lib/progress/badges";
import { cn } from "@/lib/utils";

const ICONS: Record<BadgeIcon, LucideIcon> = {
  first: CircleCheck,
  count: Target,
  streak: Flame,
  list: ListChecks,
  hard: Mountain,
  review: Repeat,
  language: Languages,
  daily: CalendarCheck,
};

const TIER_RING: Record<Badge["tier"], string> = {
  1: "border-foreground/25",
  2: "border-warning/50",
  3: "border-success/60",
};

export function BadgeGrid({ badges, className }: { badges: Badge[]; className?: string }) {
  // Earned first, then closest to completion.
  const sorted = [...badges].sort(
    (a, b) => Number(b.earned) - Number(a.earned) || b.value / b.target - a.value / a.target,
  );
  return (
    <ul
      className={cn("grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-3", className)}
    >
      {sorted.map((b) => {
        const Icon = ICONS[b.icon];
        const pct = Math.round((b.value / b.target) * 100);
        return (
          <li
            key={b.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 transition-colors",
              b.earned ? "border-border/70 bg-card" : "border-border/40 bg-card/40",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2",
                b.earned
                  ? TIER_RING[b.tier]
                  : "border-dashed border-border text-muted-foreground/60",
              )}
              aria-hidden
            >
              <Icon className={cn("h-[18px] w-[18px]", b.earned ? "text-foreground" : "")} />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn("truncate text-sm font-medium", !b.earned && "text-muted-foreground")}
              >
                {b.name}
                <span className="sr-only">{b.earned ? " (earned)" : " (locked)"}</span>
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{b.description}</p>
              {!b.earned && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/40"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {b.value}/{b.target}
                  </span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
