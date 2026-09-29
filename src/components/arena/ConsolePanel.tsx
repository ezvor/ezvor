import { CheckCircle2, Plus, SquareTerminal, X } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import type { SubmitResult } from "@/lib/judge/types";
import { cn } from "@/lib/utils";
import { ResultView } from "./ResultView";
import type { RunOutcome } from "./types";

export const MAX_CASES = 12;

type Props = {
  tab: "testcase" | "result";
  onTabChange: (t: "testcase" | "result") => void;
  cases: string[];
  onCasesChange: (cases: string[]) => void;
  activeCase: number;
  onActiveCaseChange: (i: number) => void;
  /** Expected output for an input, when it is an official example. */
  expectedFor: (input: string) => string | null;
  running: boolean;
  submitting: boolean;
  runOutcome: RunOutcome | null;
  submitResult: SubmitResult | null;
  onAskAI?: () => void;
  /** Rendered at the right of the tab strip (e.g. a collapse button). */
  actions?: React.ReactNode;
};

export function ConsolePanel(p: Props) {
  const { cases, activeCase } = p;
  const current = cases[activeCase] ?? "";
  const expected = p.expectedFor(current);

  const addCase = () => {
    if (cases.length >= MAX_CASES) return;
    p.onCasesChange([...cases, cases[activeCase] ?? ""]);
    p.onActiveCaseChange(cases.length);
  };
  const removeCase = (i: number) => {
    if (cases.length <= 1) return;
    p.onCasesChange(cases.filter((_, idx) => idx !== i));
    p.onActiveCaseChange(
      Math.max(0, Math.min(activeCase > i ? activeCase - 1 : activeCase, cases.length - 2)),
    );
  };

  const tabCls = (on: boolean) =>
    cn(
      "flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-medium transition-colors",
      on
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-1 border-b border-border/60 px-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={p.tab === "testcase"}
          onClick={() => p.onTabChange("testcase")}
          className={tabCls(p.tab === "testcase")}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Testcase
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={p.tab === "result"}
          onClick={() => p.onTabChange("result")}
          className={tabCls(p.tab === "result")}
        >
          <SquareTerminal className="h-3.5 w-3.5 text-primary" /> Test Result
        </button>
        {p.actions && <div className="ml-auto flex items-center">{p.actions}</div>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {p.tab === "testcase" ? (
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              {cases.map((_, i) => (
                <div key={i} className="group relative">
                  <button
                    type="button"
                    onClick={() => p.onActiveCaseChange(i)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      activeCase === i
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    Case {i + 1}
                  </button>
                  {cases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCase(i)}
                      aria-label={`Remove case ${i + 1}`}
                      className="absolute -right-1 -top-1 hidden rounded-full bg-destructive p-0.5 text-destructive-foreground focus-visible:block group-hover:block"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
              {cases.length < MAX_CASES && (
                <button
                  type="button"
                  onClick={addCase}
                  aria-label="Add test case"
                  title="Add test case"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <label
              htmlFor="arena-stdin"
              className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Input
            </label>
            <Textarea
              id="arena-stdin"
              value={current}
              onChange={(e) =>
                p.onCasesChange(cases.map((c, idx) => (idx === activeCase ? e.target.value : c)))
              }
              rows={4}
              spellCheck={false}
              className="mt-1.5 bg-muted/30 font-mono text-xs"
              placeholder="Input passed to your solution…"
            />
            {expected != null && (
              <>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Expected output
                </p>
                <pre className="mt-1.5 whitespace-pre-wrap rounded-md bg-muted/30 p-2.5 font-mono text-xs text-foreground/80">
                  {expected}
                </pre>
              </>
            )}
          </div>
        ) : (
          <ResultView
            running={p.running}
            submitting={p.submitting}
            runOutcome={p.runOutcome}
            submitResult={p.submitResult}
            onAskAI={p.onAskAI}
          />
        )}
      </div>
    </div>
  );
}
