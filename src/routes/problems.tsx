import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Search,
  Shuffle,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { BookmarkButton } from "@/components/progress/BookmarkButton";
import { DIFF_TEXT } from "@/components/progress/Difficulty";
import { problemHref, ProblemLink } from "@/components/progress/ProblemLink";
import { StatusIcon } from "@/components/progress/StatusIcon";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { prettyTag, type LcDifficulty, type LcProblem } from "@/data/leetcodeCatalog";
import { getList, listSlugs, STUDY_LISTS } from "@/data/lists";
import { useCollection } from "@/lib/local/store";
import { useCatalog } from "@/lib/progress/catalog";
import { attemptedSlugs, catalogTotals, solvedCounts, statusOf } from "@/lib/progress/stats";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "solved" | "attempted" | "todo";
type SortKey = "id" | "acceptance" | "difficulty" | "list";
type SortDir = "asc" | "desc";

type ProblemsSearch = {
  q?: string;
  difficulty?: LcDifficulty;
  topic?: string;
  company?: string;
  list?: string;
  status?: StatusFilter;
  bookmarked?: boolean;
  free?: boolean;
  sort?: SortKey;
  dir?: SortDir;
  page?: number;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const oneOf = <T extends string>(v: unknown, opts: readonly T[]) =>
  typeof v === "string" && (opts as readonly string[]).includes(v) ? (v as T) : undefined;

export const Route = createFileRoute("/problems")({
  validateSearch: (s: Record<string, unknown>): ProblemsSearch => ({
    q: str(s.q),
    difficulty: oneOf(s.difficulty, ["Easy", "Medium", "Hard"] as const),
    topic: str(s.topic),
    company: str(s.company),
    list: str(s.list),
    status: oneOf(s.status, ["all", "solved", "attempted", "todo"] as const),
    bookmarked: s.bookmarked === true || s.bookmarked === "true" ? true : undefined,
    free: s.free === true || s.free === "true" ? true : undefined,
    sort: oneOf(s.sort, ["id", "acceptance", "difficulty", "list"] as const),
    dir: oneOf(s.dir, ["asc", "desc"] as const),
    page: typeof s.page === "number" && s.page > 1 ? Math.floor(s.page) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Problems — Ezvor" },
      {
        name: "description",
        content:
          "All 3,900+ LeetCode problems, solvable in the browser with a real judge. Filter by difficulty, topic, company (180+ company tags), study list and your own progress.",
      },
    ],
  }),
  component: ProblemsPage,
});

const PAGE_SIZE = 50;
const DIFF_RANK: Record<LcDifficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };

function ProblemsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/problems" });
  const router = useRouter();
  const { catalog, error, bySlug } = useCatalog();
  const solved = useCollection("solved");
  const submissions = useCollection("submissions");
  const bookmarks = useCollection("bookmarks");

  // The search box is local so typing stays instant; it syncs to the URL after a pause.
  const [query, setQuery] = useState(search.q ?? "");
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);

  const list = getList(search.list);
  const difficulty = search.difficulty;
  const status = search.status ?? "all";
  const sort: SortKey = search.sort ?? (list ? "list" : "id");
  const dir: SortDir = search.dir ?? (sort === "acceptance" ? "desc" : "asc");
  const page = (search.page ?? 1) - 1;

  const update = (patch: Partial<ProblemsSearch>, keepPage = false) =>
    navigate({
      search: (prev: ProblemsSearch) => {
        const next: ProblemsSearch = { ...prev, ...patch };
        if (!keepPage) delete next.page;
        for (const k of Object.keys(next) as (keyof ProblemsSearch)[]) {
          if (next[k] === undefined || next[k] === "" || next[k] === false) delete next[k];
        }
        return next;
      },
      replace: true,
      resetScroll: false,
    });

  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? "") !== query.trim()) update({ q: query.trim() || undefined });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const attempted = useMemo(() => attemptedSlugs(submissions, solved), [submissions, solved]);
  const totals = useMemo(() => catalogTotals(catalog?.problems), [catalog]);
  const mine = useMemo(() => solvedCounts(solved, bySlug), [solved, bySlug]);

  const companyCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of catalog?.problems ?? [])
      for (const c of p.companies) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }, [catalog]);

  const topCompanies = useMemo(
    () =>
      [...companyCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name]) => name),
    [companyCounts],
  );

  const topics = useMemo(() => {
    const s = new Set<string>();
    for (const p of catalog?.problems ?? []) for (const t of p.tags) s.add(t);
    return [...s].sort();
  }, [catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [] as LcProblem[];
    const q = (search.q ?? "").toLowerCase();
    const inList = list ? new Map(listSlugs(list).map((s, i) => [s, i])) : null;
    const rows = catalog.problems.filter((p) => {
      if (inList && !inList.has(p.slug)) return false;
      if (difficulty && p.difficulty !== difficulty) return false;
      if (search.free && p.paid) return false;
      if (search.bookmarked && !bookmarks[p.slug]) return false;
      if (search.company && !p.companies.includes(search.company)) return false;
      if (search.topic && !p.tags.includes(search.topic)) return false;
      if (status !== "all" && statusOf(p.slug, solved, attempted) !== status) return false;
      if (q && !`${p.id}. ${p.title}`.toLowerCase().includes(q) && !p.slug.includes(q))
        return false;
      return true;
    });
    const sign = dir === "asc" ? 1 : -1;
    const cmp: Record<SortKey, (a: LcProblem, b: LcProblem) => number> = {
      id: (a, b) => a.id - b.id,
      acceptance: (a, b) => a.acRate - b.acRate || a.id - b.id,
      difficulty: (a, b) => DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty] || a.id - b.id,
      list: (a, b) => (inList?.get(a.slug) ?? a.id) - (inList?.get(b.slug) ?? b.id),
    };
    return rows.sort((a, b) => sign * cmp[sort](a, b));
  }, [catalog, search, list, difficulty, status, sort, dir, solved, attempted, bookmarks]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const activeFilters =
    Number(Boolean(search.q)) +
    Number(Boolean(difficulty)) +
    Number(Boolean(search.topic)) +
    Number(Boolean(search.company)) +
    Number(Boolean(list)) +
    Number(status !== "all") +
    Number(Boolean(search.bookmarked)) +
    Number(Boolean(search.free));

  const pickRandom = () => {
    if (!filtered.length) return;
    const unsolved = filtered.filter((p) => !solved[p.slug] && !p.paid);
    const pool = unsolved.length ? unsolved : filtered;
    const p = pool[Math.floor(Math.random() * pool.length)];
    router.history.push(problemHref(p.slug, list?.id));
  };

  const goToPage = (index: number) => {
    update({ page: index > 0 ? index + 1 : undefined }, true);
    document.getElementById("problem-table")?.scrollIntoView({ block: "start" });
  };

  const setSort = (key: SortKey) => {
    if (key === sort) update({ sort: key, dir: dir === "asc" ? "desc" : "asc" });
    else update({ sort: key, dir: undefined });
  };

  const SortHeader = ({
    k,
    label,
    className,
  }: {
    k: SortKey;
    label: string;
    className?: string;
  }) => (
    <th
      scope="col"
      className={cn("px-3 py-2.5 text-left font-medium", className)}
      aria-sort={sort === k ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => setSort(k)}
        className="inline-flex items-center gap-1 uppercase hover:text-foreground"
      >
        {label}
        {sort === k ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Problems"
        title="Every problem, one judge"
        description="The full LeetCode catalog with topic and company tags. Open any problem to solve it here: statements load on first open and are judged against verified tests."
      />

      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pt-6 sm:px-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Total", null, totals.total, mine.total],
              ["Easy", "Easy", totals.Easy, mine.Easy],
              ["Medium", "Medium", totals.Medium, mine.Medium],
              ["Hard", "Hard", totals.Hard, mine.Hard],
            ] as const
          ).map(([label, d, total, done]) => (
            <button
              key={label}
              type="button"
              onClick={() => update({ difficulty: d ?? undefined })}
              aria-pressed={d ? difficulty === d : !difficulty}
              className={cn(
                "rounded-xl border bg-card/60 p-4 text-left transition-colors hover:border-foreground/30",
                (d ? difficulty === d : !difficulty) ? "border-foreground/30" : "border-border/60",
              )}
            >
              <div
                className={cn("text-xs font-medium", d ? DIFF_TEXT[d] : "text-muted-foreground")}
              >
                {label}
              </div>
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                {catalog ? total.toLocaleString() : "—"}
              </div>
              <div className="text-[11px] tabular-nums text-muted-foreground">{done} solved</div>
            </button>
          ))}
        </div>

        {/* Company tags */}
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Company tags</h2>
            <span className="text-xs text-muted-foreground">
              {catalog ? `${catalog.companies.length} companies` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {topCompanies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update({ company: search.company === c ? undefined : c })}
                aria-pressed={search.company === c}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  search.company === c
                    ? "border-foreground/50 bg-muted text-foreground"
                    : "border-border/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {c}
                <span className="text-[10px] tabular-nums opacity-60">{companyCounts.get(c)}</span>
              </button>
            ))}
            <Popover open={companyPickerOpen} onOpenChange={setCompanyPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs">
                  <Search className="h-3 w-3" />
                  {search.company && !topCompanies.includes(search.company)
                    ? search.company
                    : "All companies"}
                  <ChevronsUpDown className="h-3 w-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search company…" />
                  <CommandList>
                    <CommandEmpty>No company found.</CommandEmpty>
                    <CommandGroup>
                      {catalog?.companies.map((c) => (
                        <CommandItem
                          key={c}
                          value={c}
                          onSelect={() => {
                            update({ company: search.company === c ? undefined : c });
                            setCompanyPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              search.company === c ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex-1 truncate">{c}</span>
                          <span className="text-xs text-muted-foreground">
                            {companyCounts.get(c) ?? 0}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or number"
                className="pl-9"
                aria-label="Search problems"
              />
            </div>
            <Button
              variant="outline"
              onClick={pickRandom}
              disabled={!filtered.length}
              className="gap-2"
              title="Open a random unsolved problem from the current filters"
            >
              <Shuffle className="h-4 w-4" /> Pick random
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={list?.id ?? "all"}
              onValueChange={(v) =>
                update({ list: v === "all" ? undefined : v, sort: undefined, dir: undefined })
              }
            >
              <SelectTrigger className="h-9 w-[160px]" aria-label="Study list">
                <SelectValue placeholder="List" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All problems</SelectItem>
                {STUDY_LISTS.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={difficulty ?? "all"}
              onValueChange={(v) =>
                update({ difficulty: v === "all" ? undefined : (v as LcDifficulty) })
              }
            >
              <SelectTrigger className="h-9 w-[130px]" aria-label="Difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any difficulty</SelectItem>
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={search.topic ?? "all"}
              onValueChange={(v) => update({ topic: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="h-9 w-[160px]" aria-label="Topic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Any topic</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t} value={t}>
                    {prettyTag(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(v) =>
                update({ status: v === "all" ? undefined : (v as StatusFilter) })
              }
            >
              <SelectTrigger className="h-9 w-[130px]" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="todo">Not started</SelectItem>
                <SelectItem value="attempted">Attempted</SelectItem>
                <SelectItem value="solved">Solved</SelectItem>
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => update({ bookmarked: search.bookmarked ? undefined : true })}
              aria-pressed={Boolean(search.bookmarked)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
                search.bookmarked
                  ? "border-warning/50 bg-warning/10 text-warning"
                  : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              <Bookmark className={cn("h-3.5 w-3.5", search.bookmarked && "fill-current")} />
              Bookmarked
            </button>

            <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Switch
                checked={Boolean(search.free)}
                onCheckedChange={(v) => update({ free: v || undefined })}
              />
              Hide premium
            </label>

            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  navigate({ search: {}, replace: true, resetScroll: false });
                }}
                className="inline-flex items-center gap-1 px-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm">
            Could not load the problem catalog: {error}
          </div>
        )}
        {!catalog && !error && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading problems
          </div>
        )}

        {catalog && (
          <>
            <div
              className="flex items-center justify-between text-xs text-muted-foreground"
              aria-live="polite"
            >
              <span>
                {filtered.length.toLocaleString()} problem{filtered.length === 1 ? "" : "s"}
                {list && <> in {list.name}</>}
                {search.company && <> tagged {search.company}</>}
              </span>
              {pageCount > 1 && (
                <span className="tabular-nums">
                  Page {safePage + 1} of {pageCount}
                </span>
              )}
            </div>

            <div
              id="problem-table"
              className="scroll-mt-4 overflow-hidden rounded-xl border border-border/60"
            >
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2.5">
                      <span className="sr-only">Status</span>
                    </th>
                    <SortHeader
                      k={list ? "list" : "id"}
                      label={list ? "Order" : "#"}
                      className="hidden w-20 sm:table-cell"
                    />
                    <th scope="col" className="px-3 py-2.5 text-left font-medium uppercase">
                      Title
                    </th>
                    <SortHeader
                      k="difficulty"
                      label="Difficulty"
                      className="hidden w-28 sm:table-cell"
                    />
                    <SortHeader
                      k="acceptance"
                      label="Acceptance"
                      className="hidden w-32 md:table-cell"
                    />
                    <th
                      scope="col"
                      className="hidden w-56 px-3 py-2.5 text-left font-medium uppercase lg:table-cell"
                    >
                      Companies
                    </th>
                    <th scope="col" className="w-12 px-2 py-2.5">
                      <span className="sr-only">Bookmark</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-12 text-center text-sm text-muted-foreground"
                      >
                        No problems match these filters.
                      </td>
                    </tr>
                  )}
                  {pageItems.map((p) => (
                    <tr
                      key={p.slug}
                      className="border-t border-border/40 transition-colors hover:bg-muted/20"
                    >
                      <td className="px-3 py-2.5">
                        <StatusIcon status={statusOf(p.slug, solved, attempted)} />
                      </td>
                      <td className="hidden px-3 py-2.5 tabular-nums text-muted-foreground sm:table-cell">
                        {p.id}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <ProblemLink
                            slug={p.slug}
                            list={list?.id}
                            className="truncate font-medium hover:underline"
                          >
                            <span className="sm:hidden">{p.id}. </span>
                            {p.title}
                          </ProblemLink>
                          {p.paid && (
                            <span
                              className="shrink-0 rounded border border-warning/40 px-1 text-[10px] text-warning"
                              title="Premium on LeetCode: the statement may not load here"
                            >
                              Premium
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex gap-2 truncate text-[11px] text-muted-foreground">
                          <span className={cn("font-medium sm:hidden", DIFF_TEXT[p.difficulty])}>
                            {p.difficulty}
                          </span>
                          {p.tags.slice(0, 3).map((t) => (
                            <span key={t} className="hidden sm:inline">
                              {prettyTag(t)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td
                        className={cn(
                          "hidden px-3 py-2.5 font-medium sm:table-cell",
                          DIFF_TEXT[p.difficulty],
                        )}
                      >
                        {p.difficulty}
                      </td>
                      <td className="hidden px-3 py-2.5 tabular-nums text-muted-foreground md:table-cell">
                        {p.acRate}%
                      </td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {p.companies.slice(0, 3).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => update({ company: c })}
                              className="max-w-[7rem] truncate rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              {c}
                            </button>
                          ))}
                          {p.companies.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{p.companies.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <BookmarkButton slug={p.slug} title={p.title} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <nav className="flex items-center justify-between gap-2" aria-label="Pagination">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage === 0}
                  onClick={() => goToPage(safePage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}{" "}
                  of {filtered.length.toLocaleString()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => goToPage(safePage + 1)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
