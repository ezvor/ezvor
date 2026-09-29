import type { CoachFailure } from "@/lib/coach";
import type { CaseStatus, SubmitResult } from "@/lib/judge/types";

export type LeftTab = "description" | "editorial" | "solutions" | "coach" | "notes" | "submissions";

/** One case of a "Run" (user-editable inputs). */
export type RunCase = {
  input: string;
  /** Only known while the input still matches an official example. */
  expected: string | null;
  got: string;
  stderr: string;
  timeMs: number | null;
  status: CaseStatus;
  /** null when there's nothing to compare against. */
  passed: boolean | null;
};

export type RunOutcome = {
  /** "judge" = through the problem harness; "program" = the editor run as a plain program. */
  mode: "judge" | "program";
  compileError: string | null;
  /** Infrastructure failure (runner down, ...), not the user's fault. */
  error: string | null;
  engine: string;
  cases: RunCase[];
};

export type RunVerdict =
  | "Accepted"
  | "Wrong Answer"
  | "Compile Error"
  | "Runtime Error"
  | "Time Limit Exceeded"
  | "Finished"
  | "Error";

export function runVerdict(o: RunOutcome): RunVerdict {
  if (o.compileError) return "Compile Error";
  if (o.error && o.cases.every((c) => c.status === "skipped")) return "Error";
  if (o.cases.some((c) => c.status === "tle")) return "Time Limit Exceeded";
  if (o.cases.some((c) => c.status === "re")) return "Runtime Error";
  const judged = o.cases.filter((c) => c.passed != null);
  if (!judged.length) return "Finished";
  return judged.every((c) => c.passed) ? "Accepted" : "Wrong Answer";
}

/** Failure details for the AI Coach from the latest Run, or null if it passed. */
export function runFailure(o: RunOutcome): CoachFailure | null {
  const verdict = runVerdict(o);
  if (verdict === "Accepted" || verdict === "Finished" || verdict === "Error") return null;
  if (o.compileError) return { source: "run", verdict, compileError: o.compileError };
  const c =
    o.cases.find((x) => x.status === "tle" || x.status === "re") ??
    o.cases.find((x) => x.passed === false);
  if (!c) return { source: "run", verdict };
  return {
    source: "run",
    verdict,
    input: c.input,
    expected: c.expected ?? undefined,
    got: c.got,
    stderr: c.stderr || undefined,
  };
}

/** Failure details for the AI Coach from a Submit, or null if accepted. */
export function submitFailure(r: SubmitResult): CoachFailure | null {
  if (r.allPassed || r.verdict === "Judge Error") return null;
  if (r.compileError) {
    return { source: "submit", verdict: r.verdict, compileError: r.compileError };
  }
  const c = r.cases.find((x) => !x.passed);
  return {
    source: "submit",
    verdict: r.verdict,
    passed: r.passedCount,
    total: r.total,
    hidden: c?.hidden && !c.input ? true : undefined, // input redacted by the server
    input: c?.input || undefined,
    expected: c?.expected || undefined,
    got: c?.got,
    stderr: c?.stderr || c?.error || undefined,
  };
}
