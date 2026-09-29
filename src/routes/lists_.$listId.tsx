import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  ExternalLink,
  GitBranch,
  List as ListIcon,
} from "lucide-react";

import { BookmarkButton } from "@/components/progress/BookmarkButton";
import { DIFF_TEXT, DifficultySplit } from "@/components/progress/Difficulty";
import { PatternRoadmap } from "@/components/progress/PatternRoadmap";
import { ProblemLink } from "@/components/progress/ProblemLink";
import { StatusIcon } from "@/components/progress/StatusIcon";
import { Switch } from "@/components/ui/switch";
import { prettyTag, type LcDifficulty } from "@/data/leetcodeCatalog";
import { getList, listSlugs } from "@/data/lists";
import { useCollection } from "@/lib/local/store";
import { titleFromSlug, useCatalog } from "@/lib/progress/catalog";
import { useHydrated } from "@/lib/progress/hydrated";
import { attemptedSlugs, listProgress, statusOf } from "@/lib/progress/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lists_/$listId")({
  loader: ({ params }) => {
    const list = getList(params.listId);
    if (!list) throw notFound();
    return {
      id: list.id,
      name: list.name,
      description: list.description,
      count: listSlugs(list).length,
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Ezvor` },
          {
            name: "description",
            content: `${loaderData.name}: ${loaderData.count} problems. ${loaderData.description} Solve each one in the browser and track your progress.`,
          },
        ]
      : [{ title: "Study list — Ezvor" }],
  }),
  notFoundComponent: ListNotFound,
  component: ListPage,
});

function ListNotFound() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">List not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">That study list does not exist.</p>
      <Link
        to="/lists"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All study lists
      </Link>
    </div>
  );
}

type DiffFilter = "All" | LcDifficulty;

function ListPage() {
  const { id } = Route.useLoaderData();
  const list = getList(id)!;
  const solved = useCollection("solved");
  const submissions = useCollection("submissions");
  const review = useCollection("review");
  const { bySlug } = useCatalog();
  const hydrated = useHydrated();

  const progress = useMemo(() => listProgress(list, solved), [list, solved]);
  const attempted = useMemo(() => attemptedSlugs(submissions, solved), [submissions, solved]);
  const nextSection = list.sections.find((s) => progress.next && s.slugs.includes(progress.next));

  const [view, setView] = useState<"list" | "roadmap">(list.roadmap ? "roadmap" : "list");
  const [difficulty, setDifficulty] = useState<DiffFilter>("All");
  const [hideSolved, setHideSolved] = useState(false);
  const [open, setOpen] = useState<Set<string>>(
    () =>
      new Set(
        list.sections.length <= 10 ? list.sections.map((s) => s.title) : [list.sections[0].title],
      ),
  );

  const split = useMemo(() => {
    const c = { Easy: 0, Medium: 0, Hard: 0 };
    for (const s of listSlugs(list)) {
      const d = bySlug.get(s)?.difficulty;
      if (d) c[d]++;
    }
    return c;
  }, [list, bySlug]);

  const now = hydrated ? Date.now() : 0;
  const allOpen = open.size === list.sections.length;

  const toggle = (title: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  const jumpTo = (title: string) => {
    setView("list");
    setOpen((prev) => new Set(prev).add(title));
    requestAnimationFrame(() =>
      document
        .getElementById(sectionId(title))
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="border-b border-border/60 bg-gradient-hero">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
          <Link
            to="/lists"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Study lists
          </Link>
          <div className="mt-3 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl font-bold sm:text-4xl">{list.name}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {list.description}
              </p>
              {list.source && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Source:{" "}
                  {list.sourceUrl ? (
                    <a
                      href={list.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {list.source} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    list.source
                  )}
                </p>
              )}
            </div>
            <div className="w-full shrink-0 space-y-3 md:w-72">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold tabular-nums">
                  {progress.done}
                  <span className="text-base font-normal text-muted-foreground">
                    /{progress.total}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(progress.pct * 100)}% complete
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-[width] duration-500"
                  style={{ width: `${progress.pct * 100}%` }}
                />
              </div>
              {bySlug.size > 0 && (
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <DifficultySplit
                    easy={split.Easy}
                    medium={split.Medium}
                    hard={split.Hard}
                    className="flex-1"
                  />
                  <span className="tabular-nums">
                    <span className="text-success">{split.Easy}</span> ·{" "}
                    <span className="text-warning">{split.Medium}</span> ·{" "}
                    <span className="text-destructive">{split.Hard}</span>
                  </span>
                </div>
              )}
              {progress.next ? (
                <ProblemLink
                  slug={progress.next}
                  list={list.id}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {progress.done === 0 ? "Start" : "Continue"}:{" "}
                  <span className="truncate">
                    {bySlug.get(progress.next)?.title ?? titleFromSlug(progress.next)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </ProblemLink>
              ) : (
                <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-center text-sm text-success">
                  List complete
                </p>
              )}
              {nextSection && progress.done > 0 && (
                <p className="text-center text-[11px] text-muted-foreground">
                  Up next in {nextSection.title}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pt-6 sm:px-8">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {list.roadmap && (
            <div
              className="mr-2 inline-flex rounded-lg border border-border/60 p-0.5"
              role="tablist"
              aria-label="View"
            >
              {(
                [
                  ["roadmap", "Roadmap", GitBranch],
                  ["list", "List", ListIcon],
                ] as const
              ).map(([v, label, Icon]) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    view === v
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          )}
          {view === "list" && (
            <>
              <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Difficulty">
                {(["All", "Easy", "Medium", "Hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    aria-pressed={difficulty === d}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      difficulty === d
                        ? "border-foreground/40 bg-muted text-foreground"
                        : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <label className="ml-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={hideSolved}
                  onCheckedChange={setHideSolved}
                  aria-label="Hide solved"
                />
                Hide solved
              </label>
              <button
                onClick={() =>
                  setOpen(allOpen ? new Set() : new Set(list.sections.map((s) => s.title)))
                }
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {allOpen ? (
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                )}
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </>
          )}
        </div>

        {view === "roadmap" ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-6">
            <p className="mb-5 text-xs text-muted-foreground">
              Patterns build on each other from top to bottom. Select one to see its problems.
            </p>
            <PatternRoadmap sections={progress.sections} onSelect={jumpTo} />
          </div>
        ) : (
          <div className="space-y-3">
            {list.sections.map((section, si) => {
              const sp = progress.sections[si];
              const rows = section.slugs.filter((slug) => {
                if (hideSolved && solved[slug]) return false;
                if (difficulty !== "All") {
                  const d = bySlug.get(slug)?.difficulty;
                  if (d && d !== difficulty) return false;
                }
                return true;
              });
              const isOpen = open.has(section.title);
              const complete = sp.done === sp.total;
              const panelId = `${sectionId(section.title)}-panel`;
              return (
                <section
                  key={section.title}
                  id={sectionId(section.title)}
                  className="scroll-mt-4 overflow-hidden rounded-xl border border-border/60 bg-card"
                >
                  <h2>
                    <button
                      type="button"
                      onClick={() => toggle(section.title)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          !isOpen && "-rotate-90",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold">
                        {section.title}
                      </span>
                      <span className="hidden w-32 sm:block">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              complete ? "bg-success" : "bg-foreground/60",
                            )}
                            style={{ width: `${(sp.done / sp.total) * 100}%` }}
                          />
                        </span>
                      </span>
                      <span
                        className={cn(
                          "w-12 shrink-0 text-right text-xs tabular-nums",
                          complete ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {sp.done}/{sp.total}
                      </span>
                    </button>
                  </h2>
                  {isOpen && (
                    <div id={panelId}>
                      {rows.length === 0 ? (
                        <p className="border-t border-border/40 px-4 py-3 text-xs text-muted-foreground">
                          {hideSolved && sp.done === sp.total
                            ? "All solved."
                            : "No problems match the current filters."}
                        </p>
                      ) : (
                        <ul>
                          {rows.map((slug) => {
                            const p = bySlug.get(slug);
                            const card = review[slug];
                            const reviewDue = hydrated && card && card.due <= now;
                            const status = statusOf(slug, solved, attempted);
                            const title = p?.title ?? titleFromSlug(slug);
                            return (
                              <li
                                key={slug}
                                className="flex items-center gap-3 border-t border-border/40 px-4 py-2.5 transition-colors hover:bg-muted/20"
                              >
                                <StatusIcon status={status} className="shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <ProblemLink
                                    slug={slug}
                                    list={list.id}
                                    className="block truncate text-sm font-medium hover:underline"
                                  >
                                    {title}
                                  </ProblemLink>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                    {p && (
                                      <span
                                        className={cn(
                                          "font-medium md:hidden",
                                          DIFF_TEXT[p.difficulty],
                                        )}
                                      >
                                        {p.difficulty}
                                      </span>
                                    )}
                                    {p?.tags.slice(0, 3).map((t) => (
                                      <span key={t} className="hidden sm:inline">
                                        {prettyTag(t)}
                                      </span>
                                    ))}
                                    {p?.paid && (
                                      <span
                                        className="rounded border border-warning/40 px-1 text-[10px] text-warning"
                                        title="Premium on LeetCode: the statement may not load here"
                                      >
                                        Premium
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {reviewDue && (
                                  <Link
                                    to="/progress"
                                    hash="review"
                                    className="hidden shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning sm:inline-flex"
                                    title="Review due"
                                  >
                                    <Clock className="h-3 w-3" /> Review
                                  </Link>
                                )}
                                {p && (
                                  <span
                                    className={cn(
                                      "hidden w-16 shrink-0 text-xs font-medium md:block",
                                      DIFF_TEXT[p.difficulty],
                                    )}
                                  >
                                    {p.difficulty}
                                  </span>
                                )}
                                <BookmarkButton slug={slug} title={title} className="shrink-0" />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function sectionId(title: string) {
  return `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
