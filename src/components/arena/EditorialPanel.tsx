import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  CloudUpload,
  HelpCircle,
  Lightbulb,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EditorialData } from "@/lib/editorial.functions";
import { LANGUAGE_INFO, type JudgeLang, type LangKey } from "@/lib/judge/languages";
import { cn } from "@/lib/utils";
import { IconBtn, PanelTitle } from "./ui";
import type { EditorialState } from "./useEditorial";

type Approach = EditorialData["approaches"][number];

const SOLUTION_LANGS: LangKey[] = ["python", "javascript", "cpp", "java"];

function tagStyle(tag: string) {
  if (tag === "brute") return "bg-destructive/15 text-destructive";
  if (tag === "better") return "bg-warning/15 text-warning";
  return "bg-success/15 text-success";
}

function passingLangs(a: Approach): string[] {
  return SOLUTION_LANGS.filter((l) => a.verified?.[l as JudgeLang] === true).map(
    (l) => LANGUAGE_INFO[l].label,
  );
}

function EditorialLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p>Writing a step-by-step editorial for this problem…</p>
      <p className="text-xs">Brute force to optimal, with complexity analysis.</p>
    </div>
  );
}

function EditorialError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="m-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <p>{message}</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
        <RotateCcw className="h-3.5 w-3.5" /> Try again
      </Button>
    </div>
  );
}

function EmptyState({
  onGenerate,
  kind,
}: {
  onGenerate: () => void;
  kind: "editorial" | "solutions";
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-5 py-20 text-center text-sm text-muted-foreground">
      {kind === "editorial" ? (
        <BookOpen className="h-8 w-8 text-primary/60" />
      ) : (
        <Lightbulb className="h-8 w-8 text-warning/60" />
      )}
      <p className="max-w-xs">
        {kind === "editorial"
          ? "A worked editorial for this problem: intuition, approaches and complexity."
          : "Reference solutions from brute force to optimal in Python, JavaScript, C++ and Java."}
      </p>
      <Button size="sm" onClick={onGenerate}>
        {kind === "editorial" ? "Generate editorial" : "Generate solutions"}
      </Button>
    </div>
  );
}

export function EditorialPanel({
  state,
  canRegenerate,
  onViewCode,
}: {
  state: EditorialState;
  /** Regeneration is limited to signed-in users server-side. */
  canRegenerate: boolean;
  onViewCode: (approach: number) => void;
}) {
  const { editorial, loading, error, load } = state;
  if (loading) return <EditorialLoading />;
  if (error) return <EditorialError message={error} onRetry={() => load(false)} />;
  if (!editorial) return <EmptyState kind="editorial" onGenerate={() => load(false)} />;

  return (
    <div className="h-full overflow-y-auto p-5 text-sm">
      <PanelTitle
        icon={<BookOpen className="h-4 w-4 text-primary" />}
        right={
          canRegenerate ? (
            <button
              type="button"
              onClick={() => load(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Regenerate
            </button>
          ) : null
        }
      >
        Editorial
      </PanelTitle>

      {editorial.overview && (
        <p className="mt-3 leading-relaxed text-foreground/90">{editorial.overview}</p>
      )}

      {editorial.intuition && (
        <div className="mt-4 rounded-lg border-l-4 border-primary/50 bg-primary/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Intuition</p>
          <p className="mt-1 leading-relaxed text-foreground/90">{editorial.intuition}</p>
        </div>
      )}

      {editorial.hints.length > 0 && (
        <section className="mt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-warning" /> Hints
          </h3>
          <div className="mt-2 space-y-2">
            {editorial.hints.map((h, i) => (
              <details
                key={i}
                className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs"
              >
                <summary className="cursor-pointer font-medium text-foreground">
                  Hint {i + 1}
                </summary>
                <p className="mt-2 leading-relaxed text-muted-foreground">{h}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 space-y-4">
        {editorial.approaches.map((a, i) => {
          const passing = passingLangs(a);
          return (
            <div key={i} className="rounded-xl border border-border/60 bg-muted/10 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <h3 className="font-display text-base font-bold">{a.name}</h3>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    tagStyle(a.tag),
                  )}
                >
                  {a.tag}
                </span>
              </div>
              {a.summary && <p className="mt-2 leading-relaxed text-foreground/90">{a.summary}</p>}
              {a.steps.length > 0 && (
                <ol className="mt-3 list-inside list-decimal space-y-1 text-muted-foreground">
                  {a.steps.map((s, si) => (
                    <li key={si}>{s}</li>
                  ))}
                </ol>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-muted px-2 py-1 font-mono">Time {a.time}</span>
                <span className="rounded-md bg-muted px-2 py-1 font-mono">Space {a.space}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onViewCode(i)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Code2 className="h-3.5 w-3.5" /> View code
                </button>
                {passing.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-success">
                    <CheckCircle2 className="h-3 w-3" /> Passes all tests in {passing.join(", ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!!editorial.pitfalls?.length && (
        <section className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-warning" /> Common pitfalls
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {editorial.pitfalls.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      {!!editorial.followUps?.length && (
        <section className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <HelpCircle className="h-4 w-4 text-primary" /> Follow-up questions
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {editorial.followUps.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function SolutionsPanel({
  state,
  approach,
  onApproachChange,
  preferredLang,
  onLoadCode,
}: {
  state: EditorialState;
  approach: number;
  onApproachChange: (i: number) => void;
  preferredLang: LangKey;
  onLoadCode: (lang: LangKey, code: string) => void;
}) {
  const { editorial, loading, error, load } = state;
  const [lang, setLang] = useState<LangKey>(preferredLang);
  const [copied, setCopied] = useState(false);

  if (loading) return <EditorialLoading />;
  if (error) return <EditorialError message={error} onRetry={() => load(false)} />;
  const data = editorial?.approaches[Math.min(approach, (editorial?.approaches.length ?? 1) - 1)];
  if (!editorial || !data) return <EmptyState kind="solutions" onGenerate={() => load(false)} />;

  const langs = SOLUTION_LANGS.filter((l) => data.code[l]);
  const active = data.code[lang] ? lang : (langs[0] ?? "python");
  const code = data.code[active] ?? "";
  const verified = data.verified?.[active as JudgeLang];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border/60 p-3">
        <PanelTitle icon={<Lightbulb className="h-4 w-4 text-warning" />}>Solutions</PanelTitle>
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Approaches">
          {editorial.approaches.map((a, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={a === data}
              onClick={() => onApproachChange(i)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                a === data
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded bg-muted px-2 py-1 font-mono">Time {data.time}</span>
            <span className="rounded bg-muted px-2 py-1 font-mono">Space {data.space}</span>
            {verified === true && (
              <span className="inline-flex items-center gap-1 text-success">
                <CheckCircle2 className="h-3 w-3" /> Passes all tests
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={active} onValueChange={(v) => setLang(v as LangKey)}>
              <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Solution language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {langs.map((l) => (
                  <SelectItem key={l} value={l} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      {LANGUAGE_INFO[l].label}
                      {data.verified?.[l as JudgeLang] === true && (
                        <CheckCircle2
                          className="h-3 w-3 text-success"
                          aria-label="Passes all tests"
                        />
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <IconBtn
              label="Copy code"
              onClick={() => {
                void navigator.clipboard?.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </IconBtn>
            <IconBtn label="Load into editor" onClick={() => onLoadCode(active, code)}>
              <CloudUpload className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#1e1e1e]">
        <pre className="whitespace-pre p-4 font-mono text-[12px] leading-relaxed text-[#d4d4d4]">
          {code}
        </pre>
      </div>
    </div>
  );
}
