// Interview mode: a countdown for one problem, with editorial / solutions /
// AI help hidden until it ends, followed by a short summary.

import { CheckCircle2, Clock, Hourglass, Square, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Verdict } from "@/lib/judge/types";
import { cn } from "@/lib/utils";
import { formatClock, verdictColor } from "./ui";

const DURATIONS = [20, 30, 45] as const;

type Attempt = { slug: string; verdict: Verdict; passed: number; total: number; at: number };

export type InterviewSession = {
  slug: string;
  title: string;
  startedAt: number;
  durationSec: number;
  attempts: Attempt[];
};

export type InterviewSummary = InterviewSession & { endedAt: number; timedOut: boolean };

export function useInterview() {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [summary, setSummary] = useState<InterviewSummary | null>(null);

  const start = useCallback((minutes: number, slug: string, title: string) => {
    setSummary(null);
    setSession({ slug, title, startedAt: Date.now(), durationSec: minutes * 60, attempts: [] });
  }, []);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const end = useCallback((timedOut: boolean) => {
    const s = sessionRef.current;
    if (!s) return;
    setSummary({ ...s, endedAt: Date.now(), timedOut });
    setSession(null);
  }, []);

  const record = useCallback((attempt: Omit<Attempt, "at">) => {
    setSession((s) =>
      s ? { ...s, attempts: [...s.attempts, { ...attempt, at: Date.now() }] } : s,
    );
  }, []);

  return { session, summary, start, end, record, dismiss: () => setSummary(null) };
}

function Countdown({ session, onExpire }: { session: InterviewSession; onExpire: () => void }) {
  const endsAt = session.startedAt + session.durationSec * 1000;
  const [left, setLeft] = useState(() => Math.ceil((endsAt - Date.now()) / 1000));
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    const tick = () => {
      const s = Math.ceil((endsAt - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, onExpire]);

  return (
    <span
      role="timer"
      aria-label="Interview time remaining"
      className={cn(
        "tabular-nums",
        left <= 60 ? "text-destructive" : left <= 300 ? "text-warning" : "text-foreground",
      )}
    >
      {formatClock(left)}
    </span>
  );
}

export function InterviewControl({
  session,
  onStart,
  onEnd,
}: {
  session: InterviewSession | null;
  onStart: (minutes: number) => void;
  onEnd: (timedOut: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState<number>(30);
  const expire = useCallback(() => onEnd(true), [onEnd]);

  if (session) {
    return (
      <div className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 py-0.5 pl-2 pr-0.5 text-xs font-semibold">
        <Hourglass className="h-3.5 w-3.5 text-primary" />
        <Countdown session={session} onExpire={expire} />
        <button
          type="button"
          onClick={() => onEnd(false)}
          aria-label="End interview"
          title="End interview"
          className="ml-0.5 rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <Hourglass className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Interview</span>
          <span className="sr-only xl:hidden">Interview mode</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="text-sm font-semibold">Interview mode</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          A timed attempt. Editorial, solutions and the AI Coach are hidden until you finish.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Duration">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={minutes === m}
              onClick={() => setMinutes(m)}
              className={cn(
                "rounded-md border py-1.5 text-xs font-medium transition-colors",
                minutes === m
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {m} min
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3 w-full"
          onClick={() => {
            setOpen(false);
            onStart(minutes);
          }}
        >
          Start
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function InterviewSummaryDialog({
  summary,
  onClose,
}: {
  summary: InterviewSummary | null;
  onClose: () => void;
}) {
  if (!summary) return null;
  const used = Math.min(
    summary.durationSec,
    Math.round((summary.endedAt - summary.startedAt) / 1000),
  );
  const attempts = summary.attempts.filter((a) => a.slug === summary.slug);
  const accepted = attempts.find((a) => a.verdict === "Accepted");
  const last = attempts[attempts.length - 1];
  const final = accepted ?? last;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{summary.timedOut ? "Time's up" : "Interview finished"}</DialogTitle>
          <DialogDescription>{summary.title}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="font-display text-lg font-bold tabular-nums">{formatClock(used)}</p>
            <p className="text-[11px] text-muted-foreground">of {summary.durationSec / 60} min</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="font-display text-lg font-bold tabular-nums">{attempts.length}</p>
            <p className="text-[11px] text-muted-foreground">
              submission{attempts.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="font-display text-lg font-bold tabular-nums">
              {final ? `${final.passed}/${final.total}` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">tests passed</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3 text-sm">
          {final ? (
            <>
              {accepted ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className={cn("font-semibold", verdictColor(final.verdict))}>
                {final.verdict}
              </span>
              {accepted && (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  solved at {formatClock((accepted.at - summary.startedAt) / 1000)}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">No submission during this interview.</span>
          )}
        </div>
        <DialogFooter>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
