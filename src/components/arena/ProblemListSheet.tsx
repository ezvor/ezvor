import { Link } from "@tanstack/react-router";
import { Bookmark, CheckCircle2, Circle, List, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  loadCatalog,
  prettyTag,
  SOLVABLE_SLUGS,
  type LcCatalog,
  type LcProblem,
} from "@/data/leetcodeCatalog";
import { PROBLEMS, type Difficulty } from "@/data/problems";
import { useCollection } from "@/lib/local/store";
import { cn } from "@/lib/utils";
import { diffColor } from "./ui";

const MAX_ROWS = 250;

export type CatalogFilters = {
  query: string;
  difficulty: "All" | Difficulty;
  topic: string;
  company: string;
  bookmarked: boolean;
};

const INITIAL: CatalogFilters = {
  query: "",
  difficulty: "All",
  topic: "All",
  company: "All",
  bookmarked: false,
};

/** Full problem catalog + the filters that drive both the list and prev/next. */
export function useCatalogQueue() {
  const [catalog, setCatalog] = useState<LcCatalog | null>(null);
  const [filters, setFilters] = useState<CatalogFilters>(INITIAL);
  const bookmarks = useCollection("bookmarks");

  useEffect(() => {
    loadCatalog()
      .then(setCatalog)
      .catch(() => {
        /* the queue falls back to the curated problems */
      });
  }, []);

  const filtered = useMemo(() => {
    if (!catalog) return [] as LcProblem[];
    const q = filters.query.trim().toLowerCase();
    const list = catalog.problems.filter((p) => {
      if (filters.difficulty !== "All" && p.difficulty !== filters.difficulty) return false;
      if (filters.topic !== "All" && !p.tags.includes(filters.topic)) return false;
      if (filters.company !== "All" && !p.companies.includes(filters.company)) return false;
      if (filters.bookmarked && !bookmarks[p.slug]) return false;
      if (q && !`${p.id} ${p.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      const sa = SOLVABLE_SLUGS.has(a.slug) ? 0 : 1;
      const sb = SOLVABLE_SLUGS.has(b.slug) ? 0 : 1;
      return sa !== sb ? sa - sb : a.id - b.id;
    });
  }, [catalog, filters, bookmarks]);

  // Curated problems that aren't in the LeetCode catalog (e.g. "fizzbuzz") are
  // still reachable through prev/next when no filter narrows the list.
  const queue = useMemo(() => {
    if (!catalog) return PROBLEMS.map((p) => p.id);
    return filtered.map((p) => p.slug);
  }, [catalog, filtered]);

  return { catalog, filters, setFilters, filtered, queue };
}

type Queue = ReturnType<typeof useCatalogQueue>;

export function ProblemListSheet({
  open,
  onOpenChange,
  queue,
  currentSlug,
  searchFor,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  queue: Queue;
  currentSlug: string;
  /** Search params to carry when opening `slug` (keeps an active study list). */
  searchFor: (slug: string) => { list?: string };
}) {
  const { catalog, filters, setFilters, filtered } = queue;
  const solved = useCollection("solved");
  const bookmarks = useCollection("bookmarks");
  const set = (patch: Partial<CatalogFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const topics = useMemo(() => {
    if (!catalog) return [] as string[];
    const s = new Set<string>();
    for (const p of catalog.problems) for (const t of p.tags) s.add(t);
    return [...s].sort();
  }, [catalog]);
  const companies = useMemo(() => (catalog ? [...catalog.companies].sort() : []), [catalog]);
  const bookmarkCount = Object.keys(bookmarks).length;
  const solvableCount = useMemo(
    () => filtered.filter((p) => SOLVABLE_SLUGS.has(p.slug)).length,
    [filtered],
  );

  const chip = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
      on
        ? "border-primary/50 bg-primary/15 text-foreground"
        : "border-border/60 text-muted-foreground hover:text-foreground",
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" aria-label="Problem list">
          <List className="h-4 w-4" />
          <span className="hidden sm:inline">Problem List</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border/60 p-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <List className="h-4 w-4 text-primary" /> Problem List
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-2.5 border-b border-border/60 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Search by number or title"
              aria-label="Search problems"
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["All", "Easy", "Medium", "Hard"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={filters.difficulty === d}
                onClick={() => set({ difficulty: d })}
                className={chip(filters.difficulty === d)}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={filters.bookmarked}
              onClick={() => set({ bookmarked: !filters.bookmarked })}
              className={chip(filters.bookmarked)}
            >
              <Bookmark className={cn("h-3 w-3", filters.bookmarked && "fill-current")} />
              Bookmarked
              {bookmarkCount > 0 && (
                <span className="tabular-nums text-muted-foreground">{bookmarkCount}</span>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filters.topic} onValueChange={(v) => set({ topic: v })}>
              <SelectTrigger className="h-8 text-xs" aria-label="Topic">
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
            <Select value={filters.company} onValueChange={(v) => set({ company: v })}>
              <SelectTrigger className="h-8 text-xs" aria-label="Company">
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
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {!catalog
                ? "Loading problem set…"
                : `${filtered.length.toLocaleString()} problems · ${solvableCount} curated`}
            </span>
            {(filters.topic !== "All" ||
              filters.company !== "All" ||
              filters.bookmarked ||
              filters.query) && (
              <button
                type="button"
                onClick={() => setFilters(INITIAL)}
                className="font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!catalog && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading problems…
            </div>
          )}
          {filtered.slice(0, MAX_ROWS).map((p) => {
            const active = p.slug === currentSlug;
            return (
              <Link
                key={p.slug}
                to="/problems/$slug"
                params={{ slug: p.slug }}
                search={searchFor(p.slug)}
                onClick={() => onOpenChange(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  active ? "bg-accent/60" : "hover:bg-muted/50",
                )}
              >
                <span className="w-5 shrink-0 text-center">
                  {solved[p.slug] ? (
                    <CheckCircle2 className="h-4 w-4 text-success" aria-label="Solved" />
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
                    {bookmarks[p.slug] && (
                      <Bookmark className="h-3 w-3 shrink-0 fill-current text-primary" />
                    )}
                  </span>
                </span>
                <span className={cn("shrink-0 text-xs font-semibold", diffColor(p.difficulty))}>
                  {p.difficulty}
                </span>
              </Link>
            );
          })}
          {catalog && filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {filters.bookmarked && bookmarkCount === 0
                ? "No bookmarks yet. Use the bookmark button in the editor to save problems."
                : "No problems match these filters."}
            </p>
          )}
          {filtered.length > MAX_ROWS && (
            <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">
              Showing the first {MAX_ROWS}. Refine the filters to narrow the list.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
