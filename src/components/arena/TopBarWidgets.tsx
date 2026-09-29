import { useServerFn } from "@tanstack/react-start";
import { Flame, Pause, RotateCcw, Timer as TimerIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { streakStats, useCollection } from "@/lib/local/store";
import { getStreak, type StreakInfo } from "@/lib/submissions.functions";
import { cn } from "@/lib/utils";
import { formatClock, IconBtn } from "./ui";

/** Practice streak: local activity, or the account's streak when signed in. */
export function StreakButton({ refreshKey }: { refreshKey: number }) {
  const { user, enabled } = useAuth();
  const activity = useCollection("activity");
  const local = streakStats(activity);
  const streakFn = useServerFn(getStreak);
  const [cloud, setCloud] = useState<StreakInfo | null>(null);

  useEffect(() => {
    if (!user) {
      setCloud(null);
      return;
    }
    streakFn()
      .then(setCloud)
      .catch(() => {
        /* local streak still shows */
      });
  }, [user, refreshKey, streakFn]);

  // The account streak spans devices; the local one counts every judged submit here.
  const current = Math.max(local.current, cloud?.current ?? 0);
  const longest = Math.max(local.longest, cloud?.longest ?? 0);
  const activeDays = Math.max(local.activeDays, cloud?.totalDays ?? 0);
  const today = Math.max(local.today, cloud?.todayCount ?? 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Practice streak: ${current} day${current === 1 ? "" : "s"}`}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors hover:bg-muted/50",
            current > 0 ? "text-orange-500" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Flame className={cn("h-3.5 w-3.5", current > 0 && "fill-orange-500/20")} />
          <span className="tabular-nums">{current}</span>
        </button>
      </SheetTrigger>
      <SheetContent className="w-[320px] sm:w-[360px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" /> Practice streak
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5 text-center">
            <p className="font-display text-4xl font-bold tabular-nums text-orange-500">
              {current}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              day{current === 1 ? "" : "s"} in a row
            </p>
            <p className={cn("mt-3 text-xs", today === 0 ? "text-warning" : "text-success")}>
              {today === 0
                ? "Submit a solution today to keep your streak going."
                : `${today} submission${today === 1 ? "" : "s"} today`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { v: longest, l: "Longest" },
              { v: activeDays, l: "Active days" },
              { v: today, l: "Today" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="font-display text-xl font-bold tabular-nums">{s.v}</p>
                <p className="text-[11px] text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            A day counts when you submit at least one solution.
            {enabled && !user ? " Sign in to keep your streak across devices." : ""}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Self-contained stopwatch so its tick never re-renders the arena. */
export function Stopwatch({ resetKey }: { resetKey: string }) {
  const [seconds, setSeconds] = useState(0);
  const [on, setOn] = useState(false);

  useEffect(() => {
    setSeconds(0);
    setOn(false);
  }, [resetKey]);

  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [on]);

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => setOn((t) => !t)}
        aria-label={on ? "Pause stopwatch" : "Start stopwatch"}
        title={on ? "Pause stopwatch" : "Start stopwatch"}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        {on ? <Pause className="h-3.5 w-3.5" /> : <TimerIcon className="h-3.5 w-3.5" />}
        <span className={cn("tabular-nums", (on || seconds > 0) && "text-foreground")}>
          {formatClock(seconds)}
        </span>
      </button>
      {seconds > 0 && (
        <IconBtn
          label="Reset stopwatch"
          onClick={() => {
            setSeconds(0);
            setOn(false);
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </IconBtn>
      )}
    </div>
  );
}
