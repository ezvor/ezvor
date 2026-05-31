import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Play,
  Send,
  Loader2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Terminal,
  Code2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { CodeEditor } from "@/components/CodeEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  PROBLEMS,
  LANGUAGES,
  FALLBACK_STARTER,
  type Problem,
} from "@/data/problems";
import type { LangKey } from "@/lib/judge.server";
import { executeCode, submitCode } from "@/lib/judge.functions";
import type { RunResult, SubmitResult } from "@/lib/judge.functions";

export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "Code Playground — Compile & Run DSA Solutions | PathPilot" },
      {
        name: "description",
        content:
          "A LeetCode-style online judge: write, compile and run your DSA solutions in Python, C++, Java, JavaScript and more — with real test-case judging.",
      },
    ],
  }),
  component: PlaygroundPage,
});

const STORAGE_PREFIX = "pathpilot.code.v1";

function starterFor(problem: Problem, lang: LangKey): string {
  return problem.starters[lang] ?? FALLBACK_STARTER[lang] ?? "// Write your solution here\n";
}

function diffColor(d: Problem["difficulty"]) {
  if (d === "Easy") return "bg-success/15 text-success border-success/30";
  if (d === "Medium") return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function PlaygroundPage() {
  const [problemId, setProblemId] = useState<string>(PROBLEMS[0].id);
  const [lang, setLang] = useState<LangKey>("python");
  const [code, setCode] = useState<string>(() => starterFor(PROBLEMS[0], "python"));
  const [stdin, setStdin] = useState<string>(PROBLEMS[0].examples[0]?.input ?? "");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [tab, setTab] = useState("console");

  const problem = useMemo(() => PROBLEMS.find((p) => p.id === problemId)!, [problemId]);
  const monacoLang = LANGUAGES.find((l) => l.key === lang)?.monaco ?? "plaintext";

  const runFn = useServerFn(executeCode);
  const submitFn = useServerFn(submitCode);

  const storageKey = `${STORAGE_PREFIX}.${problemId}.${lang}`;

  // Load saved code (or starter) whenever the problem/language changes — client only.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {
      saved = null;
    }
    setCode(saved ?? starterFor(problem, lang));
    setRunResult(null);
    setSubmitResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist code on change.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, code);
    } catch {
      /* ignore quota errors */
    }
  }, [code, storageKey]);

  const handleProblemChange = (id: string) => {
    const p = PROBLEMS.find((x) => x.id === id)!;
    setProblemId(id);
    setStdin(p.examples[0]?.input ?? "");
  };

  const resetCode = () => {
    setCode(starterFor(problem, lang));
    toast.success("Reset to starter code");
  };

  const handleRun = async () => {
    setRunning(true);
    setTab("console");
    try {
      const res = await runFn({ data: { language: lang, source: code, stdin } });
      setRunResult(res);
      if (res.error) toast.error(res.error);
    } catch {
      toast.error("Failed to run code. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setTab("results");
    try {
      const res = await submitFn({
        data: {
          language: lang,
          source: code,
          tests: problem.tests.map((t) => ({
            input: t.input,
            expected: t.expected,
            hidden: t.hidden ?? false,
          })),
        },
      });
      setSubmitResult(res);
      if (res.compileError) toast.error("Compilation error");
      else if (res.allPassed) toast.success(`Accepted — ${res.passedCount}/${res.total} passed 🎉`);
      else toast.error(`${res.passedCount}/${res.total} test cases passed`);
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <PageHeader
        title="Code Playground"
        subtitle="Solve DSA problems in a LeetCode-style editor — compile, run, and judge against real test cases."
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={problemId} onValueChange={handleProblemChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROBLEMS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className={cn("border", diffColor(problem.difficulty))}>
          {problem.difficulty}
        </Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">
          {problem.topic}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <Select value={lang} onValueChange={(v) => setLang(v as LangKey)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.key} value={l.key}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={resetCode} title="Reset to starter">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Problem description */}
        <div className="rounded-xl border border-border/60 bg-card/60 p-5">
          <h2 className="font-display text-xl font-bold">{problem.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{problem.description}</p>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-foreground/80">
            Input / Output
          </h3>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {problem.ioFormat}
          </pre>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-foreground/80">
            Examples
          </h3>
          <div className="mt-2 space-y-3">
            {problem.examples.map((ex, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs">
                <div className="text-muted-foreground">
                  <span className="font-semibold text-foreground/80">Input</span>
                  <pre className="mt-1 whitespace-pre-wrap font-mono">{ex.input}</pre>
                </div>
                <div className="mt-2 text-muted-foreground">
                  <span className="font-semibold text-foreground/80">Output</span>
                  <pre className="mt-1 whitespace-pre-wrap font-mono">{ex.output}</pre>
                </div>
                {ex.explanation && (
                  <p className="mt-2 text-muted-foreground">{ex.explanation}</p>
                )}
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-foreground/80">
            Constraints
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
            {problem.constraints.map((c, i) => (
              <li key={i} className="font-mono">
                {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Editor + run/submit */}
        <div className="flex flex-col gap-4">
          <div className="h-[380px] overflow-hidden rounded-xl border border-border/60 bg-[#1e1e1e]">
            <ClientOnly
              fallback={
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              }
            >
              <CodeEditor language={monacoLang} value={code} onChange={setCode} />
            </ClientOnly>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRun} disabled={running || submitting}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run
            </Button>
            <Button onClick={handleSubmit} disabled={running || submitting} className="gap-2">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit
            </Button>
            {submitResult && !submitResult.compileError && (
              <span
                className={cn(
                  "ml-auto text-sm font-semibold",
                  submitResult.allPassed ? "text-success" : "text-destructive",
                )}
              >
                {submitResult.passedCount}/{submitResult.total} passed
              </span>
            )}
          </div>

          <Tabs value={tab} onValueChange={setTab} className="rounded-xl border border-border/60 bg-card/60">
            <TabsList className="m-3 mb-0">
              <TabsTrigger value="console" className="gap-1.5">
                <Terminal className="h-3.5 w-3.5" /> Console
              </TabsTrigger>
              <TabsTrigger value="results" className="gap-1.5">
                <Code2 className="h-3.5 w-3.5" /> Test Results
              </TabsTrigger>
            </TabsList>

            {/* Console: custom input + run output */}
            <TabsContent value="console" className="p-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Custom Input (stdin)
              </label>
              <Textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                rows={3}
                className="mt-2 font-mono text-xs"
                placeholder="Type input passed to your program..."
              />
              <RunOutput result={runResult} />
            </TabsContent>

            {/* Submit results */}
            <TabsContent value="results" className="p-4">
              <SubmitOutput result={submitResult} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function RunOutput({ result }: { result: RunResult | null }) {
  if (!result) {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        Press <span className="font-semibold text-foreground/80">Run</span> to execute with the input above.
      </p>
    );
  }
  if (result.error) {
    return <Block label="Error" tone="error" text={result.error} />;
  }
  return (
    <div className="mt-4 space-y-3">
      {result.compileOutput && <Block label="Compile Output" tone="error" text={result.compileOutput} />}
      {result.timedOut && <Block label="Time Limit Exceeded" tone="error" text="Your program took too long to finish." />}
      <Block label="Output (stdout)" tone="ok" text={result.stdout || "(no output)"} />
      {result.stderr && <Block label="Errors (stderr)" tone="error" text={result.stderr} />}
      <p className="text-[11px] text-muted-foreground">
        Exit code: {result.exitCode ?? "—"}
        {result.signal ? ` · signal: ${result.signal}` : ""}
      </p>
    </div>
  );
}

function SubmitOutput({ result }: { result: SubmitResult | null }) {
  if (!result) {
    return (
      <p className="text-xs text-muted-foreground">
        Press <span className="font-semibold text-foreground/80">Submit</span> to judge your code against all test cases.
      </p>
    );
  }
  if (result.compileError) {
    return <Block label="Compilation Error" tone="error" text={result.compileError} />;
  }
  return (
    <div className="space-y-2.5">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
          result.allPassed
            ? "bg-success/15 text-success"
            : "bg-destructive/15 text-destructive",
        )}
      >
        {result.allPassed ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        {result.allPassed
          ? `Accepted · ${result.passedCount}/${result.total} test cases`
          : `Wrong Answer · ${result.passedCount}/${result.total} passed`}
      </div>

      {result.cases.map((c) => (
        <div
          key={c.index}
          className={cn(
            "rounded-lg border p-3 text-xs",
            c.passed ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
          )}
        >
          <div className="flex items-center gap-2 font-semibold">
            {c.passed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            Test case {c.index + 1}
            {c.hidden ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <EyeOff className="h-3 w-3" /> hidden
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Eye className="h-3 w-3" /> sample
              </span>
            )}
            {c.timedOut && <span className="text-destructive">· TLE</span>}
          </div>

          {!c.hidden && !c.passed && (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <MiniBlock label="Input" text={c.input} />
              <MiniBlock label="Expected" text={c.expected} />
              <MiniBlock label="Your Output" text={c.got || "(empty)"} />
            </div>
          )}
          {c.stderr && <Block label="stderr" tone="error" text={c.stderr} />}
        </div>
      ))}
    </div>
  );
}

function Block({ label, text, tone }: { label: string; text: string; tone: "ok" | "error" }) {
  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre
        className={cn(
          "mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg p-3 font-mono text-xs",
          tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground/90",
        )}
      >
        {text}
      </pre>
    </div>
  );
}

function MiniBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2 font-mono text-[11px]">
        {text}
      </pre>
    </div>
  );
}
