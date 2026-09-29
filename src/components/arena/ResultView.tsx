import {
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Globe,
  Loader2,
  MemoryStick,
  Sparkles,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SubmitResult } from "@/lib/judge/types";
import { cn } from "@/lib/utils";
import { runVerdict, type RunOutcome } from "./types";
import { formatMemory, LabeledBox, Metric, verdictColor } from "./ui";

type Props = {
  running: boolean;
  submitting: boolean;
  runOutcome: RunOutcome | null;
  submitResult: SubmitResult | null;
  /** Present when the AI Coach is available (hidden in interview mode). */
  onAskAI?: () => void;
};

export function ResultView({ running, submitting, runOutcome, submitResult, onAskAI }: Props) {
  if (running || submitting) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" />
        {running ? "Running your code…" : "Judging against all test cases…"}
      </div>
    );
  }
  if (submitResult) return <SubmitOutput result={submitResult} onAskAI={onAskAI} />;
  if (runOutcome) return <RunOutput outcome={runOutcome} onAskAI={onAskAI} />;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 py-10 text-center text-sm text-muted-foreground">
      <p>Run your code to see the output here.</p>
      <p className="text-xs">Ctrl/Cmd + Enter runs · Ctrl/Cmd + Shift + Enter submits</p>
    </div>
  );
}

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === "Accepted") return <CheckCircle2 className="h-5 w-5" />;
  if (verdict === "Time Limit Exceeded") return <Clock className="h-5 w-5" />;
  if (verdict === "Finished") return <Check className="h-5 w-5" />;
  return <XCircle className="h-5 w-5" />;
}

function AskAIButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onClick}>
      <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask AI why
    </Button>
  );
}

function EngineLine({ engine, verified }: { engine: string; verified?: boolean }) {
  const browser = engine === "browser";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        {browser ? <Cpu className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
        {browser
          ? "Judged in your browser"
          : `Judged on cloud runners${engine && engine !== "none" ? ` (${engine})` : ""}`}
      </span>
      {verified === false && (
        <span className="inline-flex items-center gap-1 text-warning">
          <TriangleAlert className="h-3 w-3" /> Unverified tests: this result isn't counted as a
          verified solve
        </span>
      )}
    </div>
  );
}

function RunOutput({ outcome, onAskAI }: { outcome: RunOutcome; onAskAI?: () => void }) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [outcome]);
  const verdict = runVerdict(outcome);
  const c = outcome.cases[Math.min(active, outcome.cases.length - 1)];
  const failing = verdict !== "Accepted" && verdict !== "Finished" && verdict !== "Error";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={cn("flex items-center gap-2 text-base font-semibold", verdictColor(verdict))}
        >
          <VerdictIcon verdict={verdict} />
          {verdict === "Error" ? "Couldn't run your code" : verdict}
          {outcome.mode === "program" && (
            <span className="text-xs font-normal text-muted-foreground">
              Ran as a program (no judge)
            </span>
          )}
        </div>
        {failing && onAskAI && <AskAIButton onClick={onAskAI} />}
      </div>

      {outcome.error && verdict === "Error" && (
        <LabeledBox label="Error" text={outcome.error} tone="error" />
      )}
      {outcome.compileError && (
        <LabeledBox label="Compiler output" text={outcome.compileError} tone="error" />
      )}

      {!outcome.compileError && c && verdict !== "Error" && (
        <>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label="Test cases"
          >
            {outcome.cases.map((o, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={active === i}
                onClick={() => setActive(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  active === i
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                <CaseDot status={o.status} passed={o.passed} />
                Case {i + 1}
              </button>
            ))}
          </div>

          {c.status === "tle" && (
            <p className="text-xs font-medium text-warning">Time limit exceeded on this case.</p>
          )}
          {c.status === "re" && (
            <p className="text-xs font-medium text-destructive">Runtime error on this case.</p>
          )}
          {c.status === "skipped" && (
            <p className="text-xs text-muted-foreground">
              Not run: an earlier case stopped the program.
            </p>
          )}

          <LabeledBox label="Input" text={c.input || "(empty)"} />
          <LabeledBox
            label="Output"
            text={c.got.trim().length ? c.got : "(no output)"}
            tone={c.passed === false ? "bad" : c.passed ? "good" : "muted"}
          />
          {c.expected != null && <LabeledBox label="Expected" text={c.expected} />}
          {c.stderr && <LabeledBox label="stderr" text={c.stderr} tone="error" />}
          {c.timeMs != null && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" /> {c.timeMs} ms
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CaseDot({ status, passed }: { status: string; passed: boolean | null }) {
  if (status === "tle") return <span className="h-2 w-2 rounded-full bg-warning" />;
  if (status === "re") return <span className="h-2 w-2 rounded-full bg-destructive" />;
  if (passed == null) return null;
  return <span className={cn("h-2 w-2 rounded-full", passed ? "bg-success" : "bg-destructive")} />;
}

function SubmitOutput({ result, onAskAI }: { result: SubmitResult; onAskAI?: () => void }) {
  if (result.verdict === "Judge Error") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold text-destructive">
          <XCircle className="h-5 w-5" /> Judge unavailable
        </div>
        <p className="text-xs text-muted-foreground">
          {result.judgeError ?? "The judge couldn't run your code right now. Please try again."}
        </p>
      </div>
    );
  }

  const firstFail = result.cases.find((c) => !c.passed);
  const failing = !result.allPassed;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-bold",
            verdictColor(result.verdict),
          )}
        >
          <span className="flex items-center gap-2">
            <VerdictIcon verdict={result.verdict} />
            {result.verdict}
          </span>
          {!result.compileError && (
            <span className="text-sm font-normal text-muted-foreground">
              {result.passedCount} / {result.total} testcases passed
            </span>
          )}
        </div>
        {failing && onAskAI && <AskAIButton onClick={onAskAI} />}
      </div>

      {!result.compileError && (result.runtimeMs != null || result.memoryKb != null) && (
        <div className="flex flex-wrap gap-2">
          {result.runtimeMs != null && (
            <Metric
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Runtime"
              value={`${result.runtimeMs} ms`}
            />
          )}
          {result.memoryKb != null && result.memoryKb > 0 && (
            <Metric
              icon={<MemoryStick className="h-3.5 w-3.5" />}
              label="Memory"
              value={formatMemory(result.memoryKb)}
            />
          )}
        </div>
      )}

      {result.compileError && (
        <LabeledBox label="Compiler output" text={result.compileError} tone="error" />
      )}

      {failing && firstFail && !result.compileError && (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-semibold text-destructive">
            Failed on test case {firstFail.index + 1}
            {firstFail.hidden ? " (hidden)" : ""}
            {firstFail.status === "tle"
              ? ": time limit exceeded"
              : firstFail.status === "re"
                ? ": runtime error"
                : ""}
          </p>
          {firstFail.input ? (
            <div className="grid gap-2 lg:grid-cols-3">
              <LabeledBox label="Input" text={firstFail.input} />
              <LabeledBox label="Expected" text={firstFail.expected || "(empty)"} />
              <LabeledBox label="Output" text={firstFail.got || "(no output)"} tone="bad" />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              This test is hidden. Think about edge cases (empty input, duplicates, limits) and
              resubmit.
            </p>
          )}
          {(firstFail.stderr || firstFail.error) && (
            <LabeledBox
              label="stderr"
              text={firstFail.stderr || firstFail.error || ""}
              tone="error"
            />
          )}
        </div>
      )}

      {result.cases.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Per-case results">
          {result.cases.map((c) => (
            <span
              key={c.index}
              title={`Case ${c.index + 1}${c.hidden ? " (hidden)" : ""}: ${
                c.passed
                  ? "passed"
                  : c.status === "tle"
                    ? "time limit"
                    : c.status === "re"
                      ? "runtime error"
                      : c.status === "skipped"
                        ? "not run"
                        : "wrong answer"
              }`}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold",
                c.passed
                  ? "bg-success/15 text-success"
                  : c.status === "tle"
                    ? "bg-warning/15 text-warning"
                    : c.status === "skipped"
                      ? "bg-muted text-muted-foreground"
                      : "bg-destructive/15 text-destructive",
              )}
            >
              {c.passed ? (
                <Check className="h-3 w-3" />
              ) : c.status === "tle" ? (
                <Clock className="h-3 w-3" />
              ) : c.status === "skipped" ? (
                "–"
              ) : (
                <X className="h-3 w-3" />
              )}
            </span>
          ))}
        </div>
      )}

      <EngineLine engine={result.engine} verified={result.verified} />
    </div>
  );
}
