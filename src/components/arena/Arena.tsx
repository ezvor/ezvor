// The problem arena (LeetCode-style solve page). Owns the per-problem state —
// code, test cases, run/submit results, judge readiness — and lays out the
// panels. Rendered by /problems/$slug; the route component is not remounted
// when the slug changes, so interview sessions and settings survive switches.

import { ClientOnly, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { editor } from "monaco-editor";
import {
  AlignLeft,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Code2,
  FileText,
  History,
  Lightbulb,
  Loader2,
  Maximize2,
  Minimize2,
  NotebookPen,
  PanelBottom,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import { toast } from "sonner";

import { CodeEditor } from "@/components/CodeEditor";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FALLBACK_STARTER, PROBLEMS, type Problem } from "@/data/problems";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/use-mobile";
import { getProblemHarness, type HarnessData } from "@/lib/harness.functions";
import { preload, runProgram, runsInBrowser, runWithHarness } from "@/lib/judge/client";
import { outputsMatch } from "@/lib/judge/compare";
import { gradeBatch } from "@/lib/judge/grade";
import {
  JUDGE_LANGS,
  LANG_KEYS,
  LANGUAGE_INFO,
  type JudgeLang,
  type LangKey,
} from "@/lib/judge/languages";
import type { SubmitResult } from "@/lib/judge/types";
import { submitSolution } from "@/lib/judge.functions";
import {
  recordSubmission as recordLocalSubmission,
  toggleBookmark,
  useCollection,
} from "@/lib/local/store";
import { cn } from "@/lib/utils";
import { harnessCache } from "./cache";
import { CoachPanel } from "./CoachPanel";
import { ConsolePanel } from "./ConsolePanel";
import { DescriptionPanel, type JudgeReadiness } from "./DescriptionPanel";
import { EditorialPanel, SolutionsPanel } from "./EditorialPanel";
import { EditorSettingsPopover, updateEditorSettings } from "./EditorSettingsPopover";
import { InterviewControl, InterviewSummaryDialog, useInterview } from "./InterviewMode";
import { ListNavigator, useStudyList } from "./ListNavigator";
import { prettyFromSlug, type ArenaData } from "./loader";
import { NotesPanel } from "./NotesPanel";
import { ProblemListSheet, useCatalogQueue } from "./ProblemListSheet";
import { SubmissionsPanel } from "./SubmissionsPanel";
import { StreakButton, Stopwatch } from "./TopBarWidgets";
import { runFailure, submitFailure, type LeftTab, type RunCase, type RunOutcome } from "./types";
import { IconBtn } from "./ui";
import { useCoach } from "./useCoach";
import { useEditorial } from "./useEditorial";

const CODE_PREFIX = "ezvor.code.v1";
const PLACEHOLDER_STARTER = "// Write your solution here\n";
const HIDDEN_IN_INTERVIEW: LeftTab[] = ["editorial", "solutions", "coach"];
/** The server accepts at most 40 fallback tests per submission. */
const MAX_FALLBACK_TESTS = 40;

const TABS: { key: LeftTab; label: string; icon: typeof FileText }[] = [
  { key: "description", label: "Description", icon: FileText },
  { key: "editorial", label: "Editorial", icon: BookOpen },
  { key: "solutions", label: "Solutions", icon: Lightbulb },
  { key: "coach", label: "AI Coach", icon: Sparkles },
  { key: "submissions", label: "Submissions", icon: History },
  { key: "notes", label: "Notes", icon: NotebookPen },
];

function starterFor(problem: Problem, lang: LangKey): string {
  return problem.starters[lang] ?? FALLBACK_STARTER[lang] ?? PLACEHOLDER_STARTER;
}

function readSavedCode(slug: string, lang: LangKey): string | null {
  try {
    return window.localStorage.getItem(`${CODE_PREFIX}.${slug}.${lang}`);
  } catch {
    return null;
  }
}

function writeSavedCode(slug: string, lang: LangKey, code: string | null) {
  try {
    const key = `${CODE_PREFIX}.${slug}.${lang}`;
    if (code == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, code);
  } catch {
    /* quota exceeded / storage blocked */
  }
}

function isJudgeLang(l: LangKey): l is JudgeLang {
  return (JUDGE_LANGS as readonly string[]).includes(l);
}

const langLabel = (l: LangKey) => LANGUAGE_INFO[l]?.label ?? l;

type HarnessState =
  | { slug: string; status: "loading" }
  | { slug: string; status: "ready"; data: HarnessData }
  | { slug: string; status: "unavailable"; reason: string };

export function Arena({ data, listId }: { data: ArenaData; listId?: string }) {
  const { slug, remote } = data;
  const navigate = useNavigate();
  // The 3-pane IDE needs ~1024px (the app sidebar takes ~256px); below that,
  // fall back to a single-pane tabbed layout.
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const { user } = useAuth();
  const settings = useCollection("settings");
  const solved = useCollection("solved");
  const bookmarks = useCollection("bookmarks");
  const studyList = useStudyList(listId);
  const queue = useCatalogQueue();
  const navigating = useRouterState({ select: (s) => s.isLoading });

  const localProblem = useMemo(() => PROBLEMS.find((p) => p.id === slug), [slug]);
  const isLocal = !!localProblem;

  /* ---------------------------------------------------------- judge harness */

  const getHarnessFn = useServerFn(getProblemHarness);
  const [harnessState, setHarnessState] = useState<HarnessState | null>(null);

  useEffect(() => {
    if (isLocal || !remote || harnessCache.has(slug)) return;
    let cancelled = false;
    setHarnessState({ slug, status: "loading" });
    getHarnessFn({ data: { slug } })
      .then((res) => {
        if (cancelled) return;
        if (res.status === "ready") {
          harnessCache.set(slug, res.harness);
          setHarnessState({ slug, status: "ready", data: res.harness });
        } else {
          setHarnessState({ slug, status: "unavailable", reason: res.reason });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHarnessState({
            slug,
            status: "unavailable",
            reason: "Couldn't prepare the judge for this problem right now.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, isLocal, remote, getHarnessFn]);

  const current = harnessState?.slug === slug ? harnessState : null;
  const harness: HarnessData | null =
    harnessCache.get(slug) ?? (current?.status === "ready" ? current.data : null);
  const harnessLoading = !isLocal && !!remote && !harness && current?.status !== "unavailable";

  // Unified view-model: curated problem, or a catalog problem backed by its harness.
  const problem = useMemo<Problem>(() => {
    if (localProblem) return localProblem;
    const tests = harness?.tests ?? [];
    return {
      id: slug,
      title: remote?.title ?? prettyFromSlug(slug),
      difficulty: remote?.difficulty ?? "Medium",
      topic: remote?.tags?.[0]?.name ?? "",
      description: "",
      ioFormat: harness?.ioFormat ?? "",
      examples: tests.filter((t) => !t.hidden).map((t) => ({ input: t.input, output: t.expected })),
      constraints: [],
      starters: remote?.snippets ?? {},
      harness: harness?.harness ?? {},
      tests,
    };
  }, [localProblem, remote, harness, slug]);

  const verifiedJudge = isLocal || !!harness?.verified;
  const readiness: JudgeReadiness = isLocal
    ? { kind: "verified" }
    : !remote
      ? { kind: "unavailable", reason: data.error ?? "This problem couldn't be loaded." }
      : harnessLoading
        ? { kind: "loading" }
        : harness && harness.tests.length
          ? { kind: harness.verified ? "verified" : "unverified" }
          : {
              kind: "unavailable",
              reason:
                current?.status === "unavailable"
                  ? current.reason
                  : "Auto-judging isn't available for this problem.",
            };

  /** Languages whose judge can be trusted for Submit. */
  const submitLangs = useMemo<LangKey[]>(() => {
    const withHarness = LANG_KEYS.filter((l) => !!problem.harness[l]);
    if (isLocal || !harness) return withHarness;
    if (harness.verified && harness.verifiedLangs?.length) {
      return withHarness.filter((l) => harness.verifiedLangs!.includes(l as JudgeLang));
    }
    return withHarness;
  }, [problem.harness, isLocal, harness]);

  /* --------------------------------------------------------------- language */

  const availableLangs = useMemo<LangKey[]>(() => {
    const ks = LANG_KEYS.filter((k) => !!problem.starters[k]);
    return ks.length ? ks : ["python"];
  }, [problem.starters]);
  const preferred = settings.preferredLanguage;
  const lang: LangKey = availableLangs.includes(preferred)
    ? preferred
    : availableLangs.includes("python")
      ? "python"
      : availableLangs[0];
  const setLang = (l: LangKey) => updateEditorSettings({ preferredLanguage: l });

  // Boot the in-browser runtime (Pyodide) as soon as it's needed.
  useEffect(() => {
    void preload(lang);
  }, [lang]);

  /* ------------------------------------------------------------------- code */

  const starter = starterFor(problem, lang);
  const [code, setCode] = useState(starter);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    setCode(readSavedCode(slug, lang) ?? starter);
  }, [slug, lang, starter]);

  const onCodeChange = (v: string) => {
    setCode(v);
    writeSavedCode(slug, lang, v);
  };

  const loadCode = (l: LangKey, source: string) => {
    writeSavedCode(slug, l, source);
    setCode(source);
    if (l !== lang) setLang(l);
    setMobileTab("code");
    toast.success("Loaded into the editor");
  };

  const resetCode = () => {
    writeSavedCode(slug, lang, null);
    setCode(starter);
    toast.success("Reset to starter code");
  };

  /* -------------------------------------------------------------- ui state */

  const [leftTab, setLeftTab] = useState<LeftTab>("description");
  const [bottomTab, setBottomTab] = useState<"testcase" | "result">("testcase");
  const [mobileTab, setMobileTab] = useState<"desc" | "code" | "console">("desc");
  const [fullscreen, setFullscreen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [solApproach, setSolApproach] = useState(0);
  const [streakKey, setStreakKey] = useState(0);
  const consoleRef = usePanelRef();
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);

  /* ------------------------------------------------------------- test cases */

  const seed = useMemo(() => problem.examples.map((e) => e.input), [problem.examples]);
  const seedKey = `${slug}|${seed.join("\u0000")}`;
  const [caseInputs, setCaseInputs] = useState<string[]>(() => (seed.length ? seed : [""]));
  const [activeCase, setActiveCase] = useState(0);

  useEffect(() => {
    setCaseInputs(seed.length ? seed : [""]);
    setActiveCase(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const expectedFor = useCallback(
    (input: string) => problem.examples.find((e) => e.input === input)?.output ?? null,
    [problem.examples],
  );

  /* -------------------------------------------------------- run / submit */

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runOutcome, setRunOutcome] = useState<RunOutcome | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const busy = running || submitting;

  // Everything that belongs to one problem resets when it changes.
  useEffect(() => {
    setRunOutcome(null);
    setSubmitResult(null);
    setBottomTab("testcase");
    setLeftTab("description");
    setSolApproach(0);
    setMobileTab("desc");
  }, [slug]);

  const showConsole = () => {
    setBottomTab("result");
    setMobileTab("console");
    if (consoleRef.current?.isCollapsed()) consoleRef.current.expand();
  };

  const submitFn = useServerFn(submitSolution);
  const interview = useInterview();
  const interviewActive = !!interview.session;

  const handleRun = useCallback(async () => {
    if (busy) return;
    setRunning(true);
    setSubmitResult(null);
    showConsole();
    const inputs = caseInputs;
    try {
      const harnessSrc = isJudgeLang(lang) ? problem.harness[lang] : undefined;
      if (!harnessSrc || !isJudgeLang(lang)) {
        // No judge for this language: run the editor contents as a plain program.
        const results = await Promise.all(
          inputs.map((stdin) => runProgram({ language: lang, source: code, stdin })),
        );
        const compileError = results.find((r) => r.compileOutput)?.compileOutput ?? null;
        const infra = results.every((r) => r.error)
          ? (results[0]?.error ?? "Execution failed.")
          : null;
        setRunOutcome({
          mode: "program",
          compileError,
          error: infra,
          engine: results[0]?.engine ?? "",
          cases: results.map<RunCase>((r, i) => ({
            input: inputs[i],
            expected: null,
            got: r.stdout ?? "",
            stderr: r.stderr || r.error || "",
            timeMs: r.timeMs,
            status: r.error
              ? "skipped"
              : r.timedOut
                ? "tle"
                : (r.exitCode != null && r.exitCode !== 0) || r.signal
                  ? "re"
                  : "ok",
            passed: null,
          })),
        });
        if (infra) toast.error(infra);
      } else {
        const run = await runWithHarness({ language: lang, harness: harnessSrc, code, inputs });
        if (run.error && run.cases.every((c) => c.status === "skipped")) toast.error(run.error);
        setRunOutcome({
          mode: "judge",
          compileError: run.compileError,
          error: run.error,
          engine: run.engine,
          cases: inputs.map<RunCase>((input, i) => {
            const c = run.cases[i];
            const status = c?.status ?? "skipped";
            const expected = expectedFor(input);
            return {
              input,
              expected,
              got: c?.stdout ?? "",
              stderr: c?.stderr ?? "",
              timeMs: c?.timeMs ?? null,
              status,
              passed:
                expected == null || run.compileError
                  ? null
                  : status === "ok" && outputsMatch(c.stdout, expected),
            };
          }),
        });
      }
    } catch {
      toast.error("Couldn't run your code. Please try again.");
    } finally {
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, lang, code, caseInputs, problem, expectedFor]);

  /** In-browser judge, used when the cloud runners are unavailable (unverified). */
  const judgeInBrowser = useCallback(async (): Promise<SubmitResult | null> => {
    const harnessSrc = isJudgeLang(lang) ? problem.harness[lang] : undefined;
    if (!harnessSrc || !isJudgeLang(lang) || !runsInBrowser(lang) || !problem.tests.length)
      return null;
    const run = await runWithHarness({
      language: lang,
      harness: harnessSrc,
      code,
      inputs: problem.tests.map((t) => t.input),
    });
    return gradeBatch(problem.tests, run, { verified: false });
  }, [problem, lang, code]);

  const handleSubmit = useCallback(async () => {
    if (busy) return;
    if (readiness.kind === "loading") {
      toast.info("The judge for this problem is still being prepared. Try again in a moment.");
      return;
    }
    if (readiness.kind === "unavailable") {
      toast.info(`${readiness.reason} Use Run to test your code.`);
      return;
    }
    if (!isJudgeLang(lang) || !submitLangs.includes(lang)) {
      const alts = submitLangs.map(langLabel).join(", ");
      toast.info(
        `${langLabel(lang)} can't be judged for this problem${alts ? `. Submit in ${alts}` : ""}; Run still works.`,
      );
      return;
    }
    const harnessSrc = problem.harness[lang]!;
    setSubmitting(true);
    setRunOutcome(null);
    showConsole();
    try {
      let res: SubmitResult | null = null;
      try {
        res = await submitFn({
          data: {
            slug,
            language: lang,
            code,
            fallback: isLocal
              ? undefined
              : {
                  harness: harnessSrc,
                  tests: problem.tests
                    .slice(0, MAX_FALLBACK_TESTS)
                    .map((t) => ({ ...t, hidden: !!t.hidden })),
                },
            meta: {
              title: problem.title,
              difficulty: problem.difficulty,
              topic: problem.topic || null,
            },
          },
        });
      } catch {
        res = null;
      }
      if (!res || res.verdict === "Judge Error") {
        const local = await judgeInBrowser().catch(() => null);
        if (local && local.verdict !== "Judge Error") res = local;
      }
      if (!res) {
        toast.error("Couldn't reach the judge. Please try again.");
        return;
      }
      setSubmitResult(res);
      if (res.verdict === "Judge Error") return;

      recordLocalSubmission({
        slug,
        title: problem.title,
        status: res.verdict,
        language: lang,
        passed: res.passedCount,
        total: res.total,
        runtimeMs: res.runtimeMs,
        memoryKb: res.memoryKb,
        code,
        verified: res.verified,
        difficulty: problem.difficulty,
        topic: problem.topic || null,
      });
      interview.record({ slug, verdict: res.verdict, passed: res.passedCount, total: res.total });
      setStreakKey((k) => k + 1);
      if (res.allPassed) toast.success(`Accepted: ${res.passedCount}/${res.total} tests passed`);
      else toast.error(res.verdict);
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    busy,
    readiness,
    lang,
    submitLangs,
    problem,
    slug,
    code,
    isLocal,
    submitFn,
    judgeInBrowser,
    interview.record,
  ]);

  /* -------------------------------------------------------------- AI coach */

  const lastFailure = submitResult
    ? submitFailure(submitResult)
    : runOutcome
      ? runFailure(runOutcome)
      : null;
  const coach = useCoach(slug, () => ({ language: lang, code, lastResult: lastFailure }));
  const askAI = () => {
    setLeftTab("coach");
    setMobileTab("desc");
    coach.send("debug", "Why is my code failing?");
  };

  /* -------------------------------------------------------------- editorial */

  const editorialState = useEditorial(
    slug,
    isLocal || !!remote,
    !interviewActive && (leftTab === "editorial" || leftTab === "solutions"),
  );

  /* ------------------------------------------------------------- navigation */

  const searchFor = useCallback(
    (target: string) => (studyList?.set.has(target) ? { list: studyList.list.id } : {}),
    [studyList],
  );
  const goTo = (target: string) =>
    navigate({ to: "/problems/$slug", params: { slug: target }, search: searchFor(target) });

  const navIndex = queue.queue.indexOf(slug);
  const shuffle = () => {
    const pool = queue.queue.filter((s) => s !== slug);
    if (pool.length) void goTo(pool[Math.floor(Math.random() * pool.length)]);
  };

  /* ----------------------------------------------------------- keyboard */

  const keys = useRef({ run: handleRun, submit: handleSubmit, toggle: () => {} });
  keys.current.run = handleRun;
  keys.current.submit = handleSubmit;
  keys.current.toggle = () => {
    if (isMobile) {
      setMobileTab((t) => (t === "console" ? "code" : "console"));
      return;
    }
    const p = consoleRef.current;
    if (!p) return;
    if (p.isCollapsed()) p.expand();
    else p.collapse();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key === "Enter") {
        // Capture phase, so Monaco doesn't swallow it as "insert line".
        e.preventDefault();
        e.stopPropagation();
        void (e.shiftKey ? keys.current.submit() : keys.current.run());
      } else if (e.key === "'" || e.code === "Quote") {
        e.preventDefault();
        keys.current.toggle();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  /* ---------------------------------------------------------- interview */

  const startInterview = (minutes: number) => {
    interview.start(minutes, slug, problem.title);
    if (HIDDEN_IN_INTERVIEW.includes(leftTab)) setLeftTab("description");
    toast.success(`Interview started: ${minutes} minutes`);
  };

  const visibleTabs = interviewActive
    ? TABS.filter((t) => !HIDDEN_IN_INTERVIEW.includes(t.key))
    : TABS;
  const activeTab: LeftTab =
    interviewActive && HIDDEN_IN_INTERVIEW.includes(leftTab) ? "description" : leftTab;

  /* ================================================================ views */

  const displayNo = isLocal
    ? String(PROBLEMS.indexOf(localProblem!) + 1)
    : (remote?.frontendId ?? "");
  const bookmarked = !!bookmarks[slug];
  const monacoLang = LANGUAGE_INFO[lang]?.monaco ?? "plaintext";

  const LeftPanel = (
    <div className="flex h-full flex-col bg-background">
      <div
        className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-border/60 bg-card/40 px-2"
        role="tablist"
        aria-label="Problem panels"
      >
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setLeftTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-2.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", t.key === "coach" && "text-primary")} />
              {t.label}
              {t.key === "coach" && coach.streaming && !active && (
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                  aria-label="Answering"
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">
        {activeTab === "description" && (
          <DescriptionPanel
            problem={problem}
            displayNo={displayNo}
            remote={remote}
            remoteError={data.error}
            isLocal={isLocal}
            solved={!!solved[slug]}
            readiness={readiness}
            ioFormat={isLocal ? null : harness?.ioFormat || null}
            hideHints={interviewActive}
          />
        )}
        {activeTab === "editorial" && (
          <EditorialPanel
            state={editorialState}
            canRegenerate={!!user}
            onViewCode={(i) => {
              setSolApproach(i);
              setLeftTab("solutions");
            }}
          />
        )}
        {activeTab === "solutions" && (
          <SolutionsPanel
            key={slug}
            state={editorialState}
            approach={solApproach}
            onApproachChange={setSolApproach}
            preferredLang={isJudgeLang(lang) ? lang : "python"}
            onLoadCode={loadCode}
          />
        )}
        {activeTab === "coach" && (
          <CoachPanel coach={coach} hasFailure={!!lastFailure} problemTitle={problem.title} />
        )}
        {activeTab === "submissions" && <SubmissionsPanel slug={slug} onLoadCode={loadCode} />}
        {activeTab === "notes" && <NotesPanel key={slug} slug={slug} />}
      </div>
    </div>
  );

  const langJudge = (() => {
    if (readiness.kind === "loading")
      return { label: "Preparing judge…", tone: "muted", tip: "" } as const;
    if (readiness.kind === "unavailable")
      return { label: "Run only", tone: "muted", tip: readiness.reason } as const;
    if (submitLangs.includes(lang)) {
      return verifiedJudge
        ? ({
            label: "Verified judge",
            tone: "good",
            tip: "Submit is judged against verified tests.",
          } as const)
        : ({
            label: "Unverified tests",
            tone: "warn",
            tip: "Tests weren't proven against a reference solution.",
          } as const);
    }
    const alts = submitLangs.map(langLabel).join(", ");
    return {
      label: "Run only",
      tone: "muted",
      tip: `No verified judge for ${langLabel(lang)} on this problem. Run executes your code as a program${alts ? `; submit in ${alts}` : ""}.`,
    } as const;
  })();

  const CodeHeader = (
    <div className="flex items-center gap-2 border-b border-border/60 bg-card/40 px-3 py-1.5">
      <Code2 className="h-4 w-4 shrink-0 text-primary" />
      <Select value={lang} onValueChange={(v) => setLang(v as LangKey)}>
        <SelectTrigger
          className="h-7 w-[140px] border-none bg-muted/50 text-xs"
          aria-label="Language"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableLangs.map((l) => (
            <SelectItem key={l} value={l} className="text-xs">
              {langLabel(l)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className={cn(
                "hidden items-center gap-1 whitespace-nowrap text-[11px] font-medium sm:inline-flex",
                langJudge.tone === "good" && "text-success",
                langJudge.tone === "warn" && "text-warning",
                langJudge.tone === "muted" && "text-muted-foreground",
              )}
            >
              {readiness.kind === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
              {langJudge.label}
            </span>
          </TooltipTrigger>
          {langJudge.tip && <TooltipContent className="max-w-xs">{langJudge.tip}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
      <div className="ml-auto flex items-center gap-0.5">
        <IconBtn
          label="Format code"
          onClick={() => void editorRef.current?.getAction("editor.action.formatDocument")?.run()}
        >
          <AlignLeft className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="Reset to starter code" onClick={resetCode}>
          <RotateCcw className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          label={bookmarked ? "Remove bookmark" : "Bookmark problem"}
          active={bookmarked}
          onClick={() => {
            const on = toggleBookmark(slug);
            toast.success(on ? "Bookmarked" : "Bookmark removed");
          }}
        >
          <Bookmark className={cn("h-4 w-4", bookmarked && "fill-primary text-primary")} />
        </IconBtn>
        <EditorSettingsPopover settings={settings} />
        {!isMobile && (
          <IconBtn
            label={consoleCollapsed ? "Show console (Ctrl+')" : "Hide console (Ctrl+')"}
            active={!consoleCollapsed}
            onClick={() => keys.current.toggle()}
          >
            <PanelBottom className="h-4 w-4" />
          </IconBtn>
        )}
        {!isMobile && (
          <IconBtn
            label={fullscreen ? "Exit fullscreen" : "Fullscreen editor"}
            onClick={() => setFullscreen((f) => !f)}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </IconBtn>
        )}
      </div>
    </div>
  );

  const EditorArea = (
    <div className="flex h-full flex-col">
      {CodeHeader}
      <div
        className={cn("min-h-0 flex-1", settings.theme === "light" ? "bg-white" : "bg-[#1e1e1e]")}
      >
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
            onChange={onCodeChange}
            settings={settings}
            onMount={(ed) => {
              editorRef.current = ed;
            }}
          />
        </ClientOnly>
      </div>
    </div>
  );

  const Console = (
    <ConsolePanel
      tab={bottomTab}
      onTabChange={setBottomTab}
      cases={caseInputs}
      onCasesChange={setCaseInputs}
      activeCase={activeCase}
      onActiveCaseChange={setActiveCase}
      expectedFor={expectedFor}
      running={running}
      submitting={submitting}
      runOutcome={runOutcome}
      submitResult={submitResult}
      onAskAI={interviewActive ? undefined : askAI}
    />
  );

  const RunSubmit = (
    <div className="flex items-center gap-1.5">
      <Button
        variant="secondary"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => void handleRun()}
        disabled={busy}
        title="Run (Ctrl/Cmd + Enter)"
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
        className={cn(
          "h-8 gap-1.5",
          readiness.kind === "verified" || readiness.kind === "unverified"
            ? "bg-success text-success-foreground hover:bg-success/90"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
        )}
        onClick={() => void handleSubmit()}
        disabled={busy}
        title={
          readiness.kind === "loading"
            ? "Preparing the judge for this problem…"
            : readiness.kind === "unavailable"
              ? readiness.reason
              : "Submit (Ctrl/Cmd + Shift + Enter)"
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
      <ProblemListSheet
        open={listOpen}
        onOpenChange={setListOpen}
        queue={queue}
        currentSlug={slug}
        searchFor={searchFor}
      />

      {studyList ? (
        <div className="hidden sm:block">
          <ListNavigator list={studyList.list} slugs={studyList.slugs} slug={slug} />
        </div>
      ) : (
        <div className="hidden items-center gap-0.5 sm:flex">
          <IconBtn
            label="Previous problem"
            onClick={() => navIndex > 0 && void goTo(queue.queue[navIndex - 1])}
            disabled={navIndex <= 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            label="Next problem"
            onClick={() => navIndex >= 0 && void goTo(queue.queue[navIndex + 1])}
            disabled={navIndex === -1 || navIndex >= queue.queue.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Random problem" onClick={shuffle} disabled={queue.queue.length < 2}>
            <Shuffle className="h-4 w-4" />
          </IconBtn>
        </div>
      )}
      {navigating && (
        <Loader2
          className="h-4 w-4 animate-spin text-muted-foreground"
          aria-label="Loading problem"
        />
      )}

      <div className="mx-auto">{RunSubmit}</div>

      <div className="flex items-center gap-1">
        <InterviewControl
          session={interview.session}
          onStart={startInterview}
          onEnd={interview.end}
        />
        <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
        <StreakButton refreshKey={streakKey} />
        {!interviewActive && (
          <div className="hidden sm:block">
            <Stopwatch resetKey={slug} />
          </div>
        )}
      </div>
    </div>
  );

  const summaryDialog = (
    <InterviewSummaryDialog summary={interview.summary} onClose={interview.dismiss} />
  );

  /* ============================================================== layouts */

  if (isMobile) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        {TopBar}
        {studyList && (
          <div className="flex justify-center border-b border-border/60 px-3 py-1.5 sm:hidden">
            <ListNavigator list={studyList.list} slugs={studyList.slugs} slug={slug} />
          </div>
        )}
        <div className="flex border-b border-border/60" role="tablist">
          {(["desc", "code", "console"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={mobileTab === t}
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
        <div className="min-h-0 flex-1">
          {mobileTab === "desc" && LeftPanel}
          {mobileTab === "code" && EditorArea}
          {mobileTab === "console" && Console}
        </div>
        {summaryDialog}
      </div>
    );
  }

  const consolePanel = (defaultSize: string) => (
    <ResizablePanel
      panelRef={consoleRef}
      defaultSize={defaultSize}
      minSize="12%"
      collapsible
      collapsedSize={0}
      onResize={(size) => setConsoleCollapsed(size.inPixels < 1)}
    >
      {Console}
    </ResizablePanel>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="truncate text-sm font-semibold">
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
          {consolePanel("32%")}
        </ResizablePanelGroup>
        {summaryDialog}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {TopBar}
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="46%" minSize="28%">
          {LeftPanel}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="54%" minSize="30%">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="60%" minSize="25%">
              {EditorArea}
            </ResizablePanel>
            <ResizableHandle withHandle />
            {consolePanel("40%")}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
      {summaryDialog}
    </div>
  );
}
