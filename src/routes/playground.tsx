import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import {
  Play,
  Loader2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
  MemoryStick,
  Maximize2,
  Minimize2,
  Check,
  Circle,
  List,
  Shuffle,
  Code2,
  Braces,
  AlignLeft,
  Bookmark,
  History,
  BookOpen,
  ExternalLink,
  Lightbulb,
  FileText,
  CloudUpload,
  Plus,
  X,
  Timer as TimerIcon,
  Pause,
} from "lucide-react";
import { toast } from "sonner";

import { CodeEditor } from "@/components/CodeEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PROBLEMS,
  LANGUAGES,
  FALLBACK_STARTER,
  buildSource,
  type Problem,
  type Difficulty,
} from "@/data/problems";
import type { LangKey } from "@/lib/judge.server";
import { executeCode, submitCode } from "@/lib/judge.functions";
import type { SubmitResult } from "@/lib/judge.functions";
import { recordSolved } from "@/lib/readiness.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  loadCatalog,
  prettyTag,
  SOLVABLE_SLUGS,
  type LcCatalog,
  type LcProblem,
} from "@/data/leetcodeCatalog";
import { getLeetProblem, type LeetProblem } from "@/lib/leetcode.functions";

export const Route = createFileRoute("/playground")({
  validateSearch: (search: Record<string, unknown>) => ({
    problem: typeof search.problem === "string" ? search.problem : undefined,
  }),
  head: () => ({
    meta: [
      { title: "EzCode — LeetCode-style Online Judge | Ezvor" },
      {
        name: "description",
        content:
          "EzCode is a LeetCode-style arena: open any of 3,977 problems in-app, write, compile and run solutions in Python, C++, Java, JavaScript and more — with a polished editor, real judging on curated problems, and topic- & company-wise practice.",
      },
    ],
  }),
  component: PlaygroundPage,
});

const CODE_PREFIX = "ezvor.code.v1";
const SOLVED_KEY = "ezvor.solved.v1";
const SUBS_PREFIX = "ezvor.subs.v1";

type SubStatus = "Accepted" | "Wrong Answer" | "Compile Error" | "Runtime Error";
type Submission = {
  id: string;
  status: SubStatus;
  lang: LangKey;
  langLabel: string;
  passed: number;
  total: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  when: number;
};

type CaseOutcome = {
  input: string;
  expected: string | null;
  got: string;
  stderr: string;
  compileOutput: string;
  timeMs: number | null;
  timedOut: boolean;
  error: string | null;
  passed: boolean | null;
};

function starterFor(problem: Problem, lang: LangKey): string {
  return problem.starters[lang] ?? FALLBACK_STARTER[lang] ?? "// Write your solution here\n";
}

function prettyFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function diffColor(d: Difficulty) {
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

function normalize(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "")
    .trim();
}

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function loadSubs(problemId: string): Submission[] {
  try {
    const raw = localStorage.getItem(`${SUBS_PREFIX}.${problemId}`);
    if (!raw) return [];
    return JSON.parse(raw) as Submission[];
  } catch {
    return [];
  }
}

function saveSubs(problemId: string, subs: Submission[]) {
  try {
    localStorage.setItem(`${SUBS_PREFIX}.${problemId}`, JSON.stringify(subs.slice(0, 25)));
  } catch {
    /* ignore */
  }
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PlaygroundPage() {
  const isMobile = useIsMobile();
  const [problemId, setProblemId] = useState<string>(PROBLEMS[0].id);
  const [lang, setLang] = useState<LangKey>("python");
  const [code, setCode] = useState<string>(() => starterFor(PROBLEMS[0], "python"));

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [caseOutcomes, setCaseOutcomes] = useState<CaseOutcome[] | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [lastRanCode, setLastRanCode] = useState(false);

  const [bottomTab, setBottomTab] = useState<"testcase" | "result">("testcase");
  const [leftTab, setLeftTab] = useState<"description" | "editorial" | "solutions" | "submissions">(
    "description",
  );

  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | Difficulty>("All");
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [subs, setSubs] = useState<Submission[]>([]);
  const [mobileTab, setMobileTab] = useState<"desc" | "code" | "console">("desc");
  const [fullscreen, setFullscreen] = useState(false);

  // Full catalog (all problems) + topic-wise / company-wise practice filters.
  const [catalog, setCatalog] = useState<LcCatalog | null>(null);
  const [topic, setTopic] = useState<string>("All");
  const [company, setCompany] = useState<string>("All");

  // Remote problem (any of the 3,977) fetched from LeetCode and opened in-app.
  const [remote, setRemote] = useState<LeetProblem | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  // Editable custom test cases (LeetCode "Case 1 / Case 2").
  const [caseInputs, setCaseInputs] = useState<string[]>(
    () => PROBLEMS[0].examples.map((e) => e.input),
  );
  const [activeCase, setActiveCase] = useState(0);

  // Stopwatch
  const [seconds, setSeconds] = useState(0);
  const [timerOn, setTimerOn] = useState(false);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const localProblem = useMemo(
    () => PROBLEMS.find((p) => p.id === problemId),
    [problemId],
  );
  const isLocal = !!localProblem;

  // Unified problem view-model: local (full judge) or a synthesized shell for a
  // remote LeetCode problem opened in-app.
  const problem = useMemo<Problem>(() => {
    if (localProblem) return localProblem;
    return {
      id: problemId,
      title: remote?.title ?? prettyFromSlug(problemId),
      difficulty: remote?.difficulty ?? "Medium",
      topic: remote?.tags?.[0]?.name ?? "LeetCode",
      description: "",
      ioFormat:
        "Write your solution in the editor. Use the Input box (and add a driver/print if needed) to Run against your own cases.",
      examples: [],
      constraints: [],
      starters: remote?.snippets ?? {},
      harness: {},
      tests: [],
    };
  }, [localProblem, remote, problemId]);

  const problemIndex = useMemo(
    () => PROBLEMS.findIndex((p) => p.id === problemId),
    [problemId],
  );
  // Human-facing problem number (LeetCode frontend id for remote problems).
  const displayNo = isLocal
    ? String(problemIndex + 1)
    : remote?.frontendId || "";
  const monacoLang = LANGUAGES.find((l) => l.key === lang)?.monaco ?? "plaintext";
  const langLabel = LANGUAGES.find((l) => l.key === lang)?.label ?? lang;
  const storageKey = `${CODE_PREFIX}.${problemId}.${lang}`;

  const runFn = useServerFn(executeCode);
  const submitFn = useServerFn(submitCode);
  const recordSolvedFn = useServerFn(recordSolved);
  const getLeetFn = useServerFn(getLeetProblem);

  useEffect(() => {
    setSolved(loadSet(SOLVED_KEY));
  }, []);

  // Load the full problem catalog (all problems) for the problem list.
  useEffect(() => {
    loadCatalog()
      .then(setCatalog)
      .catch(() => {
        /* list falls back to the locally solvable problems */
      });
  }, []);

  // Deep-link support: /playground?problem=<slug> opens that problem (local or
  // remote) directly, no redirect.
  const search = Route.useSearch();
  useEffect(() => {
    if (!search.problem || search.problem === problemId) return;
    void goToProblem(search.problem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.problem]);

  // Load saved code (or starter) whenever the problem/language changes.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {
      saved = null;
    }
    setCode(saved ?? starterFor(problem, lang));
    setCaseOutcomes(null);
    setSubmitResult(null);
    setLastRanCode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // When a remote problem finishes loading, drop in its official starter code
  // for the current language (unless the user already has saved code).
  useEffect(() => {
    if (!remote) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {
      saved = null;
    }
    if (!saved) setCode(starterFor(problem, lang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote]);

  // Reset editable cases + submissions when problem changes.
  useEffect(() => {
    const ex = problem.examples.map((e) => e.input);
    setCaseInputs(ex.length ? ex : [""]);
    setActiveCase(0);
    setSubs(loadSubs(problem.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId, remote]);

  // Persist code on change.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, code);
    } catch {
      /* ignore quota errors */
    }
  }, [code, storageKey]);

  // Stopwatch tick.
  useEffect(() => {
    if (!timerOn) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerOn]);

  const goToProblem = useCallback(
    async (id: string) => {
      setProblemId(id);
      setListOpen(false);
      setMobileTab("desc");
      setLeftTab("description");
      setRemoteError(null);

      // Local curated problem → full in-app judge, no fetch needed.
      if (PROBLEMS.some((p) => p.id === id)) {
        setRemote(null);
        return;
      }

      // Any other problem → fetch its full statement + starters and open in-app.
      setRemote(null);
      setRemoteLoading(true);
      try {
        const data = await getLeetFn({ data: { slug: id } });
        setRemote(data);
      } catch {
        setRemoteError("Couldn't load this problem right now. Please try again.");
      } finally {
        setRemoteLoading(false);
      }
    },
    [getLeetFn],
  );


  const resetCode = () => {
    setCode(starterFor(problem, lang));
    toast.success("Reset to starter code");
  };

  const formatCode = () => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
  };

  const handleRun = useCallback(async () => {
    setRunning(true);
    setBottomTab("result");
    try {
      const results = await Promise.all(
        caseInputs.map((input) =>
          runFn({
            data: { language: lang, source: buildSource(problem, lang, code), stdin: input },
          }),
        ),
      );
      const outcomes: CaseOutcome[] = results.map((r, i) => {
        const expected = problem.examples[i]?.output ?? null;
        const got = r.stdout ?? "";
        const passed =
          expected == null
            ? null
            : !r.error && !r.timedOut && !r.compileOutput && normalize(got) === normalize(expected);
        return {
          input: caseInputs[i],
          expected,
          got,
          stderr: r.stderr ?? "",
          compileOutput: r.compileOutput ?? "",
          timeMs: r.timeMs,
          timedOut: r.timedOut,
          error: r.error,
          passed,
        };
      });
      setCaseOutcomes(outcomes);
      setLastRanCode(true);
      const firstErr = results.find((r) => r.error);
      if (firstErr?.error) toast.error(firstErr.error);
    } catch {
      toast.error("Failed to run code. Please try again.");
    } finally {
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, code, caseInputs, problem]);

  const recordSubmission = useCallback(
    (res: SubmitResult) => {
      let status: SubStatus = "Accepted";
      if (res.compileError) status = "Compile Error";
      else if (res.cases.some((c) => c.error || c.timedOut)) status = "Runtime Error";
      else if (!res.allPassed) status = "Wrong Answer";
      const sub: Submission = {
        id: `${Date.now()}`,
        status,
        lang,
        langLabel,
        passed: res.passedCount,
        total: res.total,
        runtimeMs: res.runtimeMs,
        memoryKb: res.memoryKb,
        when: Date.now(),
      };
      setSubs((prev) => {
        const next = [sub, ...prev];
        saveSubs(problem.id, next);
        return next;
      });
    },
    [lang, langLabel, problem.id],
  );

  const handleSubmit = useCallback(async () => {
    if (!isLocal) {
      toast.info(
        "Verified auto-judging is available on “Solve here” problems. Use Run to test your code on this one.",
      );
      return;
    }
    setSubmitting(true);
    setBottomTab("result");
    try {
      const res = await submitFn({
        data: {
          language: lang,
          source: buildSource(problem, lang, code),
          tests: problem.tests.map((t) => ({
            input: t.input,
            expected: t.expected,
            hidden: t.hidden ?? false,
          })),
        },
      });
      setSubmitResult(res);
      setCaseOutcomes(null);
      recordSubmission(res);
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
        // Record verified proof for the Readiness Engine (only when signed in).
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return;
          recordSolvedFn({
            data: {
              problemId: problem.id,
              title: problem.title,
              difficulty: problem.difficulty,
              topic: problem.topic ?? null,
              language: lang,
              runtimeMs: res.runtimeMs != null ? Math.round(res.runtimeMs) : null,
              memoryKb: res.memoryKb != null ? Math.round(res.memoryKb) : null,
            },
          }).catch(() => {
            /* proof sync is best-effort */
          });
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
  }, [lang, code, problem, recordSubmission]);

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

  const topics = useMemo(() => {
    if (!catalog) return [] as string[];
    const s = new Set<string>();
    for (const p of catalog.problems) for (const t of p.tags) s.add(t);
    return [...s].sort();
  }, [catalog]);

  const companies = useMemo(
    () => (catalog ? [...catalog.companies].sort() : ([] as string[])),
    [catalog],
  );

  // The full, filtered problem list — powers topic-wise & company-wise practice.
  const catalogFiltered = useMemo(() => {
    if (!catalog) return [] as LcProblem[];
    const q = query.trim().toLowerCase();
    const list = catalog.problems.filter((p) => {
      if (filter !== "All" && p.difficulty !== filter) return false;
      if (topic !== "All" && !p.tags.includes(topic)) return false;
      if (company !== "All" && !p.companies.includes(company)) return false;
      if (q && !`${p.id} ${p.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const sa = SOLVABLE_SLUGS.has(a.slug) ? 0 : 1;
      const sb = SOLVABLE_SLUGS.has(b.slug) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.id - b.id;
    });
  }, [catalog, query, filter, topic, company]);

  // Slugs that can be solved here with the verified judge (curated set).
  const solvableQueue = useMemo(
    () => catalogFiltered.filter((p) => SOLVABLE_SLUGS.has(p.slug)).map((p) => p.slug),
    [catalogFiltered],
  );
  // Next/Prev cycles through the whole filtered list — every problem opens in-app.
  const navQueue = catalogFiltered.length
    ? catalogFiltered.map((p) => p.slug)
    : PROBLEMS.map((p) => p.id);
  const navIndex = navQueue.indexOf(problemId);

  const busy = running || submitting;

  const updateCase = (i: number, val: string) => {
    setCaseInputs((prev) => prev.map((c, idx) => (idx === i ? val : c)));
  };
  const addCase = () => {
    setCaseInputs((prev) => [...prev, prev[prev.length - 1] ?? ""]);
    setActiveCase(caseInputs.length);
  };
  const removeCase = (i: number) => {
    if (caseInputs.length <= 1) return;
    setCaseInputs((prev) => prev.filter((_, idx) => idx !== i));
    setActiveCase((a) => Math.max(0, Math.min(a, caseInputs.length - 2)));
  };

  /* ================= sub-views ================= */

  const ProblemList = (
    <div className="flex h-full flex-col">
      <div className="space-y-2.5 border-b border-border/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all problems…"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
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
        <div className="grid grid-cols-2 gap-2">
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Topic" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="All">All topics</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>
                  {prettyTag(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={company} onValueChange={setCompany}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="All">All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(topic !== "All" || company !== "All") && (
          <button
            onClick={() => {
              setTopic("All");
              setCompany("All");
            }}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Clear list filters
          </button>
        )}
        <p className="text-[11px] text-muted-foreground">
          {!catalog
            ? "Loading full problem set…"
            : `${catalogFiltered.length.toLocaleString()} problems · ${solvableQueue.length} solvable here`}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!catalog && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading problems…
          </div>
        )}
        {(catalog ? catalogFiltered.slice(0, 250) : []).map((p) => {
          const solvable = SOLVABLE_SLUGS.has(p.slug);
          const isActive = p.slug === problemId;
          const isSolved = solved.has(p.slug);
          const cls = cn(
            "mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
            isActive ? "bg-accent/60" : "hover:bg-muted/50",
          );
          return (
            <button key={p.slug} onClick={() => goToProblem(p.slug)} className={cls}>
              <span className="w-5 shrink-0 text-center">
                {isSolved ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Circle className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {p.id}. {p.title}
                </span>
                <span className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                  {p.tags.slice(0, 2).map(prettyTag).join(" · ") || "General"}
                  {solvable && (
                    <span className="rounded bg-primary/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-primary">
                      Solve here
                    </span>
                  )}
                </span>
              </span>
              <span className={cn("shrink-0 text-xs font-semibold", diffColor(p.difficulty))}>
                {p.difficulty}
              </span>
            </button>
          );
        })}
        {catalog && catalogFiltered.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No problems match your search.
          </p>
        )}
        {catalog && catalogFiltered.length > 250 && (
          <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">
            Showing first 250 — refine filters to narrow the list.
          </p>
        )}
      </div>
    </div>
  );

  const LeftTabs = (
    <div className="flex items-center gap-1 border-b border-border/60 bg-card/40 px-2">
      {[
        { key: "description", label: "Description", icon: FileText },
        { key: "editorial", label: "Editorial", icon: BookOpen },
        { key: "solutions", label: "Solutions", icon: Lightbulb },
        { key: "submissions", label: "Submissions", icon: History },
      ].map((t) => {
        const Icon = t.icon;
        const active = leftTab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setLeftTab(t.key as typeof leftTab)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-xs font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );

  const DescriptionBody = (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-bold">
          {displayNo ? `${displayNo}. ` : ""}
          {problem.title}
        </h1>
        {solved.has(problem.id) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
            <Check className="h-3 w-3" /> Solved
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            problem.difficulty === "Easy"
              ? "bg-success/15 text-success"
              : problem.difficulty === "Medium"
                ? "bg-warning/15 text-warning"
                : "bg-destructive/15 text-destructive",
          )}
        >
          {problem.difficulty}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          {problem.topic}
        </span>
        {isLocal ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
            <CheckCircle2 className="h-3 w-3" /> Verified judge
          </span>
        ) : (
          <a
            href={`https://leetcode.com/problems/${problem.id}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" /> View on LeetCode
          </a>
        )}
      </div>

      {/* ---- Remote (any LeetCode problem, opened in-app) ---- */}
      {!isLocal && remoteLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading problem…
        </div>
      )}
      {!isLocal && !remoteLoading && remoteError && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {remoteError}
        </div>
      )}
      {!isLocal && !remoteLoading && remote && (
        <>
          <div
            className="lc-content mt-4"
            // Content is fetched from LeetCode and sanitized server-side.
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
          {remote.hints.length > 0 && (
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
                    <div
                      className="lc-content mt-2"
                      dangerouslySetInnerHTML={{ __html: h }}
                    />
                  </details>
                ))}
              </div>
            </div>
          )}
          <div className="mt-6 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            The official starter code is loaded in the editor. Write your solution
            and <span className="font-medium text-foreground">Run</span> it against
            your own inputs. Verified auto-judging + shareable proof is available on
            the curated{" "}
            <span className="font-medium text-primary">Solve here</span> problems.
          </div>
        </>
      )}

      {/* ---- Local curated problem (full verified judge) ---- */}
      {isLocal && (
        <>
          <p className="mt-4 text-sm leading-relaxed text-foreground/90">
            <Inline text={problem.description} />
          </p>

          <div className="mt-6 space-y-4">
            {problem.examples.map((ex, i) => (
              <div key={i}>
                <p className="text-sm font-semibold">Example {i + 1}:</p>
                <div className="mt-2 rounded-lg border-l-4 border-border bg-muted/30 p-3 text-xs">
                  <p>
                    <span className="font-semibold">Input:</span>
                    <pre className="mt-1 whitespace-pre-wrap font-mono text-foreground/90">{ex.input}</pre>
                  </p>
                  <p className="mt-2">
                    <span className="font-semibold">Output:</span>
                    <pre className="mt-1 whitespace-pre-wrap font-mono text-foreground/90">{ex.output}</pre>
                  </p>
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

          <h3 className="mt-6 text-sm font-semibold">I/O Format</h3>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {problem.ioFormat}
          </pre>

          <h3 className="mt-6 text-sm font-semibold">Constraints:</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
            {problem.constraints.map((c, i) => (
              <li key={i} className="font-mono">
                {c}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );

  const EditorialBody = (
    <div className="h-full overflow-y-auto p-5 text-sm">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold">Approach</h2>
      </div>
      <p className="mt-3 text-muted-foreground">
        This is a <span className="font-semibold text-foreground">{problem.topic}</span> problem.
        Read the full input from <code className="rounded bg-muted px-1">stdin</code>, compute the
        answer inside the provided function, and print it to{" "}
        <code className="rounded bg-muted px-1">stdout</code> exactly as described in the I/O format.
      </p>
      <h3 className="mt-5 text-sm font-semibold">Hints</h3>
      <ul className="mt-2 list-inside list-disc space-y-1.5 text-muted-foreground">
        <li>Start with the brute-force idea, then optimize.</li>
        <li>
          For <span className="font-medium text-foreground">{problem.topic}</span>, a hash map or two
          pointers often reduces time complexity from O(n²) to O(n).
        </li>
        <li>Watch the constraints: {problem.constraints[0]} determines the acceptable complexity.</li>
        <li>Handle edge cases (empty / single element / all-equal inputs).</li>
      </ul>
      <div className="mt-6 rounded-lg border border-border/60 bg-muted/20 p-4">
        <p className="text-xs text-muted-foreground">
          Tip: Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">⌘/Ctrl + Enter</kbd> to
          Run against your visible cases and{" "}
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">⌘/Ctrl + Shift + Enter</kbd> to
          Submit against every hidden case.
        </p>
      </div>
    </div>
  );

  const SolutionsBody = (
    <div className="h-full overflow-y-auto p-5 text-sm">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-warning" />
        <h2 className="font-display text-lg font-bold">Solutions</h2>
      </div>
      <p className="mt-3 text-muted-foreground">
        Write your own solution in the editor and Submit to validate it against all hidden tests.
        Below is the recommended structure for each language — the starter already wires up input
        parsing so you only implement the core function.
      </p>
      <div className="mt-4 space-y-3">
        {LANGUAGES.filter((l) => problem.starters[l.key]).map((l) => (
          <details key={l.key} className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-medium">{l.label} template</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre rounded bg-background/60 p-3 font-mono text-[11px] text-foreground/90">
              {problem.starters[l.key]}
            </pre>
          </details>
        ))}
      </div>
    </div>
  );

  const SubmissionsBody = (
    <div className="h-full overflow-y-auto p-5 text-sm">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold">Submissions</h2>
      </div>
      {subs.length === 0 ? (
        <p className="mt-4 text-muted-foreground">
          No submissions yet for this problem. Solve it and hit{" "}
          <span className="font-semibold text-foreground">Submit</span> to see your history here.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Language</th>
                <th className="px-3 py-2 text-left font-medium">Runtime</th>
                <th className="px-3 py-2 text-left font-medium">Memory</th>
                <th className="px-3 py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-t border-border/50">
                  <td
                    className={cn(
                      "px-3 py-2 font-semibold",
                      s.status === "Accepted" ? "text-success" : "text-destructive",
                    )}
                  >
                    {s.status}
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({s.passed}/{s.total})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.langLabel}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.runtimeMs != null ? `${s.runtimeMs} ms` : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.memoryKb != null ? `${(s.memoryKb / 1024).toFixed(1)} MB` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{timeAgo(s.when)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const LeftPanel = (
    <div className="flex h-full flex-col bg-background">
      {LeftTabs}
      <div className="min-h-0 flex-1">
        {leftTab === "description" && DescriptionBody}
        {leftTab === "editorial" && EditorialBody}
        {leftTab === "solutions" && SolutionsBody}
        {leftTab === "submissions" && SubmissionsBody}
      </div>
    </div>
  );

  const CodeHeader = (
    <div className="flex flex-col border-b border-border/60 bg-card/40">
      <div className="flex items-center gap-2 px-3 py-2">
        <Code2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Code</span>
        <div className="ml-auto flex items-center gap-0.5">
          <IconBtn label="Format code" onClick={formatCode}>
            <AlignLeft className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Reset to starter" onClick={resetCode}>
            <RotateCcw className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Brackets" onClick={formatCode}>
            <Braces className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Bookmark" onClick={() => toast.success("Bookmarked")}>
            <Bookmark className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            label={fullscreen ? "Exit fullscreen" : "Fullscreen editor"}
            onClick={() => setFullscreen((f) => !f)}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </IconBtn>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 pb-2">
        <Select value={lang} onValueChange={(v) => setLang(v as LangKey)}>
          <SelectTrigger className="h-7 w-[150px] border-none bg-muted/50 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.filter((l) => problem.starters[l.key]).map((l) => (
              <SelectItem key={l.key} value={l.key}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const EditorArea = (
    <div className="flex h-full flex-col">
      {CodeHeader}
      <div className="min-h-0 flex-1 bg-[#1e1e1e]">
        <ClientOnly
          fallback={
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          }
        >
          <CodeEditor
            language={monacoLang}
            value={code}
            onChange={setCode}
            onMount={(ed) => {
              editorRef.current = ed;
            }}
          />
        </ClientOnly>
      </div>
    </div>
  );

  const ConsoleArea = (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-1 border-b border-border/60 px-2">
        <button
          onClick={() => setBottomTab("testcase")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-medium transition-colors",
            bottomTab === "testcase"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Testcase
        </button>
        <button
          onClick={() => setBottomTab("result")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-medium transition-colors",
            bottomTab === "result"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Play className="h-3.5 w-3.5 text-primary" /> Test Result
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {bottomTab === "testcase" ? (
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              {caseInputs.map((_, i) => (
                <div key={i} className="group relative">
                  <button
                    onClick={() => setActiveCase(i)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      activeCase === i
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    Case {i + 1}
                  </button>
                  {caseInputs.length > 1 && (
                    <button
                      onClick={() => removeCase(i)}
                      className="absolute -right-1 -top-1 hidden rounded-full bg-destructive p-0.5 text-destructive-foreground group-hover:block"
                      title="Remove case"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addCase}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                title="Add test case"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Input (stdin)
            </label>
            <Textarea
              value={caseInputs[activeCase] ?? ""}
              onChange={(e) => updateCase(activeCase, e.target.value)}
              rows={4}
              className="mt-1.5 bg-muted/30 font-mono text-xs"
              placeholder="Input passed to your program…"
            />
            {problem.examples[activeCase]?.output != null && (
              <>
                <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Expected output
                </label>
                <pre className="mt-1.5 whitespace-pre-wrap rounded-md bg-muted/30 p-2.5 font-mono text-xs text-foreground/80">
                  {problem.examples[activeCase].output}
                </pre>
              </>
            )}
          </div>
        ) : (
          <ResultView
            running={running}
            submitting={submitting}
            caseOutcomes={caseOutcomes}
            submitResult={submitResult}
            lastRanCode={lastRanCode}
          />
        )}
      </div>
    </div>
  );

  /* ================= top bar ================= */
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const shuffleProblem = () => {
    const pool = navQueue.filter((id) => id !== problemId);
    if (!pool.length) return;
    goToProblem(pool[Math.floor(Math.random() * pool.length)]);
  };

  const RunSubmit = (
    <div className="flex items-center gap-1.5">
      <Button
        variant="secondary"
        size="sm"
        className="h-8 gap-1.5"
        onClick={handleRun}
        disabled={busy}
        title="Run (⌘/Ctrl + Enter)"
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Run
      </Button>
      <Button
        size="sm"
        className={cn(
          "h-8 gap-1.5",
          isLocal
            ? "bg-success text-success-foreground hover:bg-success/90"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
        )}
        onClick={handleSubmit}
        disabled={busy}
        title={
          isLocal
            ? "Submit (⌘/Ctrl + Shift + Enter)"
            : "Verified judging is available on “Solve here” problems"
        }
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CloudUpload className="h-3.5 w-3.5" />
        )}
        Submit
      </Button>
    </div>
  );

  const TopBar = (
    <div className="flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-2 backdrop-blur">
      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Problem List</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
          <SheetHeader className="border-b border-border/60 p-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <List className="h-4 w-4 text-primary" /> Problem List
            </SheetTitle>
          </SheetHeader>
          {ProblemList}
        </SheetContent>
      </Sheet>

      <div className="hidden items-center gap-0.5 sm:flex">
        <IconBtn
          label="Previous problem"
          onClick={() => navIndex > 0 && goToProblem(navQueue[navIndex - 1])}
          disabled={navIndex <= 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          label="Next problem"
          onClick={() =>
            navIndex >= 0 &&
            navIndex < navQueue.length - 1 &&
            goToProblem(navQueue[navIndex + 1])
          }
          disabled={navIndex === -1 || navIndex >= navQueue.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="Random problem" onClick={shuffleProblem}>
          <Shuffle className="h-4 w-4" />
        </IconBtn>
      </div>

      <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

      {/* Center Run / Submit */}
      <div className="mx-auto">{RunSubmit}</div>

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => setTimerOn((t) => !t)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title={timerOn ? "Pause timer" : "Start timer"}
        >
          {timerOn ? <Pause className="h-3.5 w-3.5" /> : <TimerIcon className="h-3.5 w-3.5" />}
          <span className="tabular-nums">{mm}:{ss}</span>
        </button>
        {seconds > 0 && (
          <IconBtn
            label="Reset timer"
            onClick={() => {
              setSeconds(0);
              setTimerOn(false);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </IconBtn>
        )}
      </div>
    </div>
  );

  /* ================= layouts ================= */

  if (isMobile) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        {TopBar}
        <div className="flex border-b border-border/60">
          {(["desc", "code", "console"] as const).map((t) => (
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
              {t === "desc" ? "Problem" : t === "code" ? "Code" : "Result"}
            </button>
          ))}
        </div>
        {mobileTab === "desc" && <div className="min-h-0 flex-1">{LeftPanel}</div>}
        {mobileTab === "code" && <div className="min-h-0 flex-1">{EditorArea}</div>}
        {mobileTab === "console" && <div className="min-h-0 flex-1">{ConsoleArea}</div>}
      </div>
    );
  }

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="text-sm font-semibold">
            {displayNo ? `${displayNo}. ` : ""}
            {problem.title}
          </span>
          <div className="flex items-center gap-2">
            {RunSubmit}
            <IconBtn label="Exit fullscreen" onClick={() => setFullscreen(false)}>
              <Minimize2 className="h-4 w-4" />
            </IconBtn>
          </div>
        </div>
        <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
          <ResizablePanel defaultSize="68%" minSize="30%">
            {EditorArea}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="32%" minSize="15%">
            {ConsoleArea}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {TopBar}
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="44%" minSize="25%">
          {LeftPanel}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="56%" minSize="35%">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="60%" minSize="25%">
              {EditorArea}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="40%" minSize="15%">
              {ConsoleArea}
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

/* ================= small components ================= */

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ResultView({
  running,
  submitting,
  caseOutcomes,
  submitResult,
  lastRanCode,
}: {
  running: boolean;
  submitting: boolean;
  caseOutcomes: CaseOutcome[] | null;
  submitResult: SubmitResult | null;
  lastRanCode: boolean;
}) {
  if (running) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Running your code…
      </div>
    );
  }
  if (submitting) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Judging against all test cases…
      </div>
    );
  }

  // Submit result takes priority when it exists.
  if (submitResult) {
    return <SubmitOutput result={submitResult} />;
  }

  if (caseOutcomes) {
    return <RunOutput outcomes={caseOutcomes} />;
  }

  if (!lastRanCode) {
    return (
      <div className="flex h-full items-center justify-center py-10 text-center text-sm text-muted-foreground">
        You must run your code first
      </div>
    );
  }
  return null;
}

function RunOutput({ outcomes }: { outcomes: CaseOutcome[] }) {
  const [active, setActive] = useState(0);
  const c = outcomes[Math.min(active, outcomes.length - 1)];
  const anyPass = outcomes.some((o) => o.passed);
  const allPass = outcomes.every((o) => o.passed);
  const hasVerdict = outcomes.some((o) => o.passed != null);

  return (
    <div className="space-y-3">
      {hasVerdict && (
        <div
          className={cn(
            "flex items-center gap-2 text-base font-semibold",
            allPass ? "text-success" : "text-destructive",
          )}
        >
          {allPass ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          {allPass ? "Accepted" : anyPass ? "Partial" : "Wrong Answer"}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {outcomes.map((o, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              active === i ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            {o.passed != null &&
              (o.passed ? (
                <span className="h-2 w-2 rounded-full bg-success" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-destructive" />
              ))}
            Case {i + 1}
          </button>
        ))}
      </div>

      {c.error && <Block label="Error" tone="error" text={c.error} />}
      {c.compileOutput && <Block label="Compile output" tone="error" text={c.compileOutput} />}
      {c.timedOut && <Block label="Result" tone="error" text="Time limit exceeded" />}

      <LabeledBox label="Input" text={c.input} />
      <LabeledBox
        label="Output"
        text={c.got.trim().length ? c.got : "(no output)"}
        tone={c.passed === false ? "bad" : c.passed ? "good" : "muted"}
      />
      {c.expected != null && <LabeledBox label="Expected" text={c.expected} />}
      {c.stderr && <Block label="stderr" tone="error" text={c.stderr} />}
      {c.timeMs != null && (
        <p className="text-[11px] text-muted-foreground">
          <Clock className="mr-1 inline h-3 w-3" />
          {c.timeMs} ms
        </p>
      )}
    </div>
  );
}

function SubmitOutput({ result }: { result: SubmitResult }) {
  if (result.compileError) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold text-destructive">
          <XCircle className="h-5 w-5" /> Compile Error
        </div>
        <Block label="Compiler output" tone="error" text={result.compileError} />
      </div>
    );
  }
  const firstFail = result.cases.find((c) => !c.passed);
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 text-lg font-bold",
          result.allPassed ? "text-success" : "text-destructive",
        )}
      >
        {result.allPassed ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        {result.allPassed ? "Accepted" : "Wrong Answer"}
        <span className="text-sm font-normal text-muted-foreground">
          {result.passedCount} / {result.total} testcases passed
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {result.runtimeMs != null && (
          <Metric icon={<Clock className="h-3.5 w-3.5" />} label="Runtime" value={`${result.runtimeMs} ms`} />
        )}
        {result.memoryKb != null && (
          <Metric
            icon={<MemoryStick className="h-3.5 w-3.5" />}
            label="Memory"
            value={`${(result.memoryKb / 1024).toFixed(1)} MB`}
          />
        )}
      </div>

      {!result.allPassed && firstFail && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-semibold text-destructive">
            Failed on test case {firstFail.index + 1}
            {firstFail.hidden ? " (hidden)" : ""}
          </p>
          {!firstFail.hidden && (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <LabeledBox label="Input" text={firstFail.input} />
              <LabeledBox label="Expected" text={firstFail.expected} />
              <LabeledBox label="Your output" text={firstFail.got || "(empty)"} tone="bad" />
            </div>
          )}
          {firstFail.hidden && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              This is a hidden test — refine your solution and resubmit.
            </p>
          )}
          {firstFail.stderr && <Block label="stderr" tone="error" text={firstFail.stderr} />}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {result.cases.map((c) => (
          <span
            key={c.index}
            title={`Case ${c.index + 1}${c.hidden ? " (hidden)" : ""}`}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold",
              c.passed
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive",
            )}
          >
            {c.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </span>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}

function LabeledBox({
  label,
  text,
  tone = "muted",
}: {
  label: string;
  text: string;
  tone?: "muted" | "good" | "bad";
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <pre
        className={cn(
          "mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md p-2.5 font-mono text-xs",
          tone === "bad"
            ? "bg-destructive/10 text-destructive"
            : tone === "good"
              ? "bg-success/10 text-foreground/90"
              : "bg-muted/40 text-foreground/90",
        )}
      >
        {text}
      </pre>
    </div>
  );
}

function Block({ label, text, tone }: { label: string; text: string; tone: "error" }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre
        className={cn(
          "mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg p-3 font-mono text-xs",
          tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground/90",
        )}
      >
        {text}
      </pre>
    </div>
  );
}
