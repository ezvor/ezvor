import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Send,
  Loader2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Terminal,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Search,
  Cpu,
  Clock,
  MemoryStick,
  Maximize2,
  Eye,
  EyeOff,
  Check,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";

import { CodeEditor } from "@/components/CodeEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PROBLEMS,
  LANGUAGES,
  FALLBACK_STARTER,
  type Problem,
  type Difficulty,
} from "@/data/problems";
import type { LangKey, RunResult } from "@/lib/judge.server";
import { executeCode, submitCode } from "@/lib/judge.functions";
import type { SubmitResult } from "@/lib/judge.functions";

export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "Code Playground — Compile & Run DSA Solutions | PathPilot" },
      {
        name: "description",
        content:
          "A LeetCode-style online judge: write, compile and run your DSA solutions in Python, C++, Java, JavaScript and more — with real test-case judging, runtime stats and a polished editor.",
      },
    ],
  }),
  component: PlaygroundPage,
});

const CODE_PREFIX = "pathpilot.code.v1";
const SOLVED_KEY = "pathpilot.solved.v1";

function starterFor(problem: Problem, lang: LangKey): string {
  return problem.starters[lang] ?? FALLBACK_STARTER[lang] ?? "// Write your solution here\n";
}

function diffColor(d: Difficulty) {
  if (d === "Easy") return "bg-success/15 text-success border-success/30";
  if (d === "Medium") return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function diffDot(d: Difficulty) {
  if (d === "Easy") return "text-success";
  if (d === "Medium") return "text-warning";
  return "text-destructive";
}

/** Renders text with `inline code` markdown into JSX. */
function Inline({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((p, i) =>
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

function loadSolved(): Set<string> {
  try {
    const raw = localStorage.getItem(SOLVED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function PlaygroundPage() {
  const isMobile = useIsMobile();
  const [problemId, setProblemId] = useState<string>(PROBLEMS[0].id);
  const [lang, setLang] = useState<LangKey>("python");
  const [code, setCode] = useState<string>(() => starterFor(PROBLEMS[0], "python"));
  const [stdin, setStdin] = useState<string>(PROBLEMS[0].examples[0]?.input ?? "");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [tab, setTab] = useState("testcase");
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | Difficulty>("All");
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [mobileTab, setMobileTab] = useState<"desc" | "code">("desc");

  const problem = useMemo(() => PROBLEMS.find((p) => p.id === problemId)!, [problemId]);
  const problemIndex = useMemo(
    () => PROBLEMS.findIndex((p) => p.id === problemId),
    [problemId],
  );
  const monacoLang = LANGUAGES.find((l) => l.key === lang)?.monaco ?? "plaintext";
  const storageKey = `${CODE_PREFIX}.${problemId}.${lang}`;

  const runFn = useServerFn(executeCode);
  const submitFn = useServerFn(submitCode);

  // Hydrate solved set on mount (client only).
  useEffect(() => {
    setSolved(loadSolved());
  }, []);

  // Load saved code (or starter) whenever the problem/language changes.
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

  const goToProblem = useCallback((id: string) => {
    const p = PROBLEMS.find((x) => x.id === id)!;
    setProblemId(id);
    setStdin(p.examples[0]?.input ?? "");
    setListOpen(false);
    setMobileTab("desc");
  }, []);

  const resetCode = () => {
    setCode(starterFor(problem, lang));
    toast.success("Reset to starter code");
  };

  const handleRun = useCallback(async () => {
    setRunning(true);
    setTab("testcase");
    try {
      const res = await runFn({ data: { language: lang, source: code, stdin } });
      setRunResult(res);
      if (res.error) toast.error(res.error);
    } catch {
      toast.error("Failed to run code. Please try again.");
    } finally {
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, code, stdin]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setTab("result");
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
      if (res.compileError) {
        toast.error("Compilation error");
      } else if (res.allPassed) {
        toast.success(`Accepted — ${res.passedCount}/${res.total} passed 🎉`);
        setSolved((prev) => {
          const next = new Set(prev);
          next.add(problem.id);
          try {
            localStorage.setItem(SOLVED_KEY, JSON.stringify([...next]));
          } catch {
            /* ignore */
          }
          return next;
        });
      } else {
        toast.error(`${res.passedCount}/${res.total} test cases passed`);
      }
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, code, problem]);

  // Keyboard shortcuts: Ctrl/Cmd+Enter = Run, Ctrl/Cmd+Shift+Enter = Submit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) handleSubmit();
        else handleRun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleRun, handleSubmit]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROBLEMS.filter((p) => {
      if (filter !== "All" && p.difficulty !== filter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q)
      );
    });
  }, [query, filter]);

  const busy = running || submitting;

  /* ---------- shared sub-views ---------- */

  const ProblemList = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems…"
            className="h-9 pl-8"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {(["All", "Easy", "Medium", "Hard"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                filter === f
                  ? "border-primary/50 bg-primary/15 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {solved.size}/{PROBLEMS.length} solved · {filtered.length} shown
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.map((p, i) => {
          const isActive = p.id === problemId;
          const isSolved = solved.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => goToProblem(p.id)}
              className={cn(
                "mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                isActive ? "bg-accent/60" : "hover:bg-muted/50",
              )}
            >
              <span className="w-5 shrink-0 text-center">
                {isSolved ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {p.title}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {p.topic}
                </span>
              </span>
              <span className={cn("shrink-0 text-xs font-semibold", diffDot(p.difficulty))}>
                {p.difficulty}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No problems match your search.
          </p>
        )}
      </div>
    </div>
  );

  const Description = (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-bold">
          {problemIndex + 1}. {problem.title}
        </h1>
        {solved.has(problem.id) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
            <Check className="h-3 w-3" /> Solved
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("border", diffColor(problem.difficulty))}>
          {problem.difficulty}
        </Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">
          {problem.topic}
        </Badge>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        <Inline text={problem.description} />
      </p>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-foreground/80">
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
              <p className="mt-2 text-muted-foreground">
                <span className="font-semibold text-foreground/80">Explanation: </span>
                {ex.explanation}
              </p>
            )}
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-foreground/80">
        I/O Format
      </h3>
      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        {problem.ioFormat}
      </pre>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-foreground/80">
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
  );

  const EditorToolbar = (
    <div className="flex items-center gap-2 border-b border-border/60 bg-card/40 px-3 py-2">
      <Code2Badge />
      <Select value={lang} onValueChange={(v) => setLang(v as LangKey)}>
        <SelectTrigger className="h-8 w-[155px] text-xs">
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
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={resetCode}
        title="Reset to starter code"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={handleRun}
          disabled={busy}
          title="Run (⌘/Ctrl + Enter)"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Run
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1.5 bg-success text-success-foreground hover:bg-success/90"
          onClick={handleSubmit}
          disabled={busy}
          title="Submit (⌘/Ctrl + Shift + Enter)"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Submit
        </Button>
      </div>
    </div>
  );

  const EditorArea = (
    <div className="flex h-full flex-col">
      {EditorToolbar}
      <div className="min-h-0 flex-1 bg-[#1e1e1e]">
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
    </div>
  );

  const ConsoleArea = (
    <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
      <TabsList className="m-2 mb-0 w-fit">
        <TabsTrigger value="testcase" className="gap-1.5 text-xs">
          <Terminal className="h-3.5 w-3.5" /> Testcase
        </TabsTrigger>
        <TabsTrigger value="result" className="gap-1.5 text-xs">
          <ListChecks className="h-3.5 w-3.5" /> Result
        </TabsTrigger>
      </TabsList>

      <TabsContent value="testcase" className="min-h-0 flex-1 overflow-y-auto p-3">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Custom input (stdin)
        </label>
        <Textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          rows={3}
          className="mt-1.5 font-mono text-xs"
          placeholder="Input passed to your program…"
        />
        <RunOutput result={runResult} running={running} />
      </TabsContent>

      <TabsContent value="result" className="min-h-0 flex-1 overflow-y-auto p-3">
        <SubmitOutput result={submitResult} running={submitting} />
      </TabsContent>
    </Tabs>
  );

  /* ---------- top bar ---------- */
  const TopBar = (
    <div className="flex items-center gap-2 border-b border-border/60 bg-background/80 px-3 py-2 backdrop-blur">
      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Problems</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
          <SheetHeader className="border-b border-border/60 p-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4 text-primary" /> Problem List
            </SheetTitle>
          </SheetHeader>
          {ProblemList}
        </SheetContent>
      </Sheet>

      <div className="mx-1 hidden items-center gap-1 sm:flex">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={problemIndex === 0}
          onClick={() => goToProblem(PROBLEMS[problemIndex - 1].id)}
          title="Previous problem"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={problemIndex === PROBLEMS.length - 1}
          onClick={() => goToProblem(PROBLEMS[problemIndex + 1].id)}
          title="Next problem"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-semibold">
          {problemIndex + 1}. {problem.title}
        </span>
        <span className={cn("hidden shrink-0 text-xs font-semibold sm:inline", diffDot(problem.difficulty))}>
          {problem.difficulty}
        </span>
      </div>

      <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:flex">
        <Cpu className="h-3.5 w-3.5" /> {LANGUAGES.length} languages · real online judge
      </span>
    </div>
  );

  /* ---------- responsive layouts ---------- */

  if (isMobile) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        {TopBar}
        <div className="flex border-b border-border/60">
          {(["desc", "code"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMobileTab(t)}
              className={cn(
                "flex-1 py-2 text-sm font-medium transition-colors",
                mobileTab === t
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {t === "desc" ? "Description" : "Code & Run"}
            </button>
          ))}
        </div>
        {mobileTab === "desc" ? (
          <div className="min-h-0 flex-1">{Description}</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="h-[55%] min-h-0">{EditorArea}</div>
            <div className="min-h-0 flex-1 border-t border-border/60">{ConsoleArea}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {TopBar}
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="42%" minSize="25%">
          {Description}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="58%" minSize="35%">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="62%" minSize="25%">
              {EditorArea}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="38%" minSize="15%">
              {ConsoleArea}
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function Code2Badge() {
  return (
    <span className="hidden items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground md:flex">
      <Maximize2 className="h-3 w-3" /> Editor
    </span>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

function RunOutput({ result, running }: { result: RunResult | null; running: boolean }) {
  if (running) {
    return (
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Running your code…
      </div>
    );
  }
  if (!result) {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        Press <span className="font-semibold text-foreground/80">Run</span> (or ⌘/Ctrl + Enter)
        to execute with the input above.
      </p>
    );
  }
  if (result.error) {
    return <Block label="Error" tone="error" text={result.error} />;
  }
  const empty = result.stdout.trim().length === 0;
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {result.compileOutput ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive">
            <XCircle className="h-3.5 w-3.5" /> Compilation error
          </span>
        ) : result.timedOut ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive">
            <Clock className="h-3.5 w-3.5" /> Time limit exceeded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Finished
          </span>
        )}
        {result.timeMs != null && (
          <Stat icon={<Clock className="h-3 w-3" />} label={`${result.timeMs} ms`} />
        )}
        {result.memoryKb != null && (
          <Stat icon={<MemoryStick className="h-3 w-3" />} label={`${(result.memoryKb / 1024).toFixed(1)} MB`} />
        )}
        <Stat icon={<Cpu className="h-3 w-3" />} label={`exit ${result.exitCode ?? "—"}`} />
      </div>

      {result.compileOutput && <Block label="Compile output" tone="error" text={result.compileOutput} />}
      <Block
        label="Output (stdout)"
        tone={empty ? "muted" : "ok"}
        text={
          empty
            ? "(no output) — your program printed nothing. If you're still on the starter, implement the TODO so your function returns/prints the answer."
            : result.stdout
        }
      />
      {result.stderr && <Block label="Errors (stderr)" tone="error" text={result.stderr} />}
    </div>
  );
}

function SubmitOutput({ result, running }: { result: SubmitResult | null; running: boolean }) {
  if (running) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Judging against all test cases…
      </div>
    );
  }
  if (!result) {
    return (
      <p className="text-xs text-muted-foreground">
        Press <span className="font-semibold text-foreground/80">Submit</span> (or ⌘/Ctrl +
        Shift + Enter) to judge your code against every test case, including hidden ones.
      </p>
    );
  }
  if (result.compileError) {
    return <Block label="Compilation error" tone="error" text={result.compileError} />;
  }
  return (
    <div className="space-y-2.5">
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
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
        {result.runtimeMs != null && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-normal opacity-90">
            <Clock className="h-3 w-3" /> {result.runtimeMs} ms
          </span>
        )}
        {result.memoryKb != null && (
          <span className="inline-flex items-center gap-1 text-xs font-normal opacity-90">
            <MemoryStick className="h-3 w-3" /> {(result.memoryKb / 1024).toFixed(1)} MB
          </span>
        )}
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
            {c.timeMs != null && (
              <span className="ml-auto text-[11px] font-normal text-muted-foreground">
                {c.timeMs} ms
              </span>
            )}
          </div>

          {!c.hidden && !c.passed && (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <MiniBlock label="Input" text={c.input} />
              <MiniBlock label="Expected" text={c.expected} />
              <MiniBlock label="Your output" text={c.got || "(empty)"} />
            </div>
          )}
          {c.stderr && <Block label="stderr" tone="error" text={c.stderr} />}
        </div>
      ))}
    </div>
  );
}

function Block({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "ok" | "error" | "muted";
}) {
  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <pre
        className={cn(
          "mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg p-3 font-mono text-xs",
          tone === "error"
            ? "bg-destructive/10 text-destructive"
            : tone === "muted"
              ? "bg-muted/40 text-muted-foreground"
              : "bg-muted/50 text-foreground/90",
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
