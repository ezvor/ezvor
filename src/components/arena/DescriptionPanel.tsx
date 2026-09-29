import { Check, CheckCircle2, ExternalLink, Info, Loader2, TriangleAlert } from "lucide-react";

import type { Problem } from "@/data/problems";
import type { LeetProblem } from "@/lib/leetcode.functions";
import { cn } from "@/lib/utils";
import { diffPill } from "./ui";

export type JudgeReadiness =
  | { kind: "verified" }
  | { kind: "unverified" }
  | { kind: "loading" }
  | { kind: "unavailable"; reason: string };

/** Renders `inline code` spans in curated statements. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((p, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
          >
            {p}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function JudgeBadge({ readiness }: { readiness: JudgeReadiness }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";
  switch (readiness.kind) {
    case "verified":
      return (
        <span
          className={cn(base, "bg-success/15 text-success")}
          title="Expected outputs were proven by running a reference solution against the official examples."
        >
          <CheckCircle2 className="h-3 w-3" /> Verified judge
        </span>
      );
    case "unverified":
      return (
        <span
          className={cn(base, "bg-warning/15 text-warning")}
          title="Test cases weren't proven against a reference solution. Results may be wrong."
        >
          <TriangleAlert className="h-3 w-3" /> Unverified tests
        </span>
      );
    case "loading":
      return (
        <span className={cn(base, "bg-muted text-muted-foreground")}>
          <Loader2 className="h-3 w-3 animate-spin" /> Preparing judge…
        </span>
      );
    default:
      return (
        <span className={cn(base, "bg-muted text-muted-foreground")} title={readiness.reason}>
          <Info className="h-3 w-3" /> Run only
        </span>
      );
  }
}

export function DescriptionPanel({
  problem,
  displayNo,
  remote,
  remoteError,
  isLocal,
  solved,
  readiness,
  ioFormat,
  hideHints,
}: {
  problem: Problem;
  displayNo: string;
  remote: LeetProblem | null;
  remoteError: string | null;
  isLocal: boolean;
  solved: boolean;
  readiness: JudgeReadiness;
  /** How custom Run input is formatted (from the judge harness). */
  ioFormat: string | null;
  /** Interview mode keeps official hints folded away. */
  hideHints: boolean;
}) {
  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-bold">
          {displayNo ? `${displayNo}. ` : ""}
          {problem.title}
        </h1>
        {solved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
            <Check className="h-3 w-3" /> Solved
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            diffPill(problem.difficulty),
          )}
        >
          {problem.difficulty}
        </span>
        {problem.topic && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {problem.topic}
          </span>
        )}
        <JudgeBadge readiness={readiness} />
        {!isLocal && (
          <a
            href={`https://leetcode.com/problems/${problem.id}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" /> LeetCode
          </a>
        )}
      </div>

      {readiness.kind === "unavailable" && (
        <p className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          {readiness.reason} You can still write code and use{" "}
          <span className="font-medium text-foreground">Run</span> to execute it with your own
          input.
        </p>
      )}
      {readiness.kind === "unverified" && (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          The tests for this problem couldn't be proven against a reference solution yet, so a
          verdict may occasionally be wrong. Submissions are judged but not counted as verified.
        </p>
      )}

      {!isLocal && remoteError && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {remoteError}
        </div>
      )}

      {!isLocal && remote && (
        <>
          <div
            className="lc-content mt-4"
            // Statement HTML is fetched from LeetCode and sanitized server-side.
            dangerouslySetInnerHTML={{ __html: remote.contentHtml }}
          />
          {remote.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {remote.tags.map((t) => (
                <span
                  key={t.slug}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
          {ioFormat && (
            <details className="mt-5 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
              <summary className="cursor-pointer font-medium text-foreground">
                Custom input format
              </summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground">
                {ioFormat}
              </pre>
            </details>
          )}
          {remote.hints.length > 0 && !hideHints && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Hints</h3>
              <div className="mt-2 space-y-2">
                {remote.hints.map((h, i) => (
                  <details
                    key={i}
                    className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs"
                  >
                    <summary className="cursor-pointer font-medium text-foreground">
                      Hint {i + 1}
                    </summary>
                    <div className="lc-content mt-2" dangerouslySetInnerHTML={{ __html: h }} />
                  </details>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {isLocal && (
        <>
          <p className="mt-4 text-sm leading-relaxed text-foreground/90">
            <Inline text={problem.description} />
          </p>
          <div className="mt-6 space-y-4">
            {problem.examples.map((ex, i) => (
              <div key={i}>
                <p className="text-sm font-semibold">Example {i + 1}</p>
                <div className="mt-2 rounded-lg border-l-4 border-border bg-muted/30 p-3 text-xs">
                  <p className="font-semibold">Input</p>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-foreground/90">
                    {ex.input}
                  </pre>
                  <p className="mt-2 font-semibold">Output</p>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-foreground/90">
                    {ex.output}
                  </pre>
                  {ex.explanation && (
                    <p className="mt-2 text-muted-foreground">
                      <span className="font-semibold text-foreground/80">Explanation: </span>
                      {ex.explanation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <h3 className="mt-6 text-sm font-semibold">Input format</h3>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {problem.ioFormat}
          </pre>
          {problem.constraints.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold">Constraints</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {problem.constraints.map((c, i) => (
                  <li key={i} className="font-mono">
                    {c}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
