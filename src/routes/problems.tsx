import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Check,
  ChevronsUpDown,
  Crown,
  Loader2,
  Play,
  Search,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  loadCatalog,
  prettyTag,
  SOLVABLE_SLUGS,
  type LcCatalog,
  type LcDifficulty,
  type LcProblem,
} from "@/data/leetcodeCatalog";

export const Route = createFileRoute("/problems")({
  head: () => ({
    meta: [
      { title: "All LeetCode Problems + Free Company Lists | PathPilot" },
      {
        name: "description",
        content:
          "Browse all 3,977 LeetCode problems with topic tags, difficulty and acceptance rate — plus free company-wise lists (Google, Amazon, Microsoft, Meta and 180+ more) usually locked behind Premium.",
      },
    ],
  }),
  component: ProblemsPage,
});

const PAGE_SIZE = 50;

function diffColor(d: LcDifficulty) {
  if (d === "Easy") return "text-emerald-400";
  if (d === "Medium") return "text-amber-400";
  return "text-rose-400";
}

function ProblemsPage() {
  const [catalog, setCatalog] = useState<LcCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<"All" | LcDifficulty>("All");
  const [company, setCompany] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>("All");
  const [freeOnly, setFreeOnly] = useState(false);
  const [solvableOnly, setSolvableOnly] = useState(false);
  const [sort, setSort] = useState<"number" | "acceptance-desc" | "acceptance-asc">("number");
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    loadCatalog().then(setCatalog).catch((e) => setError(e.message));
  }, []);

  // Reset to first page whenever filters change.
  useEffect(() => {
    setPage(0);
  }, [query, difficulty, company, topic, freeOnly, solvableOnly, sort]);

  const companyCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (!catalog) return m;
    for (const p of catalog.problems) {
      for (const c of p.companies) m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [catalog]);

  const topCompanies = useMemo(
    () =>
      [...companyCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([name]) => name),
    [companyCounts],
  );

  const topics = useMemo(() => {
    if (!catalog) return [];
    const s = new Set<string>();
    for (const p of catalog.problems) for (const t of p.tags) s.add(t);
    return [...s].sort();
  }, [catalog]);

  const stats = useMemo(() => {
    if (!catalog) return { total: 0, easy: 0, medium: 0, hard: 0, free: 0 };
    let easy = 0,
      medium = 0,
      hard = 0,
      free = 0;
    for (const p of catalog.problems) {
      if (p.difficulty === "Easy") easy++;
      else if (p.difficulty === "Medium") medium++;
      else hard++;
      if (!p.paid) free++;
    }
    return { total: catalog.problems.length, easy, medium, hard, free };
  }, [catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [] as LcProblem[];
    const q = query.trim().toLowerCase();
    let list = catalog.problems.filter((p) => {
      if (difficulty !== "All" && p.difficulty !== difficulty) return false;
      if (freeOnly && p.paid) return false;
      if (solvableOnly && !SOLVABLE_SLUGS.has(p.slug)) return false;
      if (company && !p.companies.includes(company)) return false;
      if (topic !== "All" && !p.tags.includes(topic)) return false;
      if (q) {
        const hay = `${p.id} ${p.title}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "acceptance-desc") list = [...list].sort((a, b) => b.acRate - a.acRate);
    else if (sort === "acceptance-asc") list = [...list].sort((a, b) => a.acRate - b.acRate);
    else list = [...list].sort((a, b) => a.id - b.id);
    return list;
  }, [catalog, query, difficulty, company, topic, freeOnly, solvableOnly, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="LeetCode Premium — unlocked, free"
        title="Problem Catalog"
        description="All 3,977 LeetCode problems with topic tags, difficulty and acceptance — plus free company-wise lists (Google, Amazon, Microsoft, Meta and 180+ more)."
      />

      <div className="space-y-6 px-4 pt-4 md:px-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Total", value: stats.total, cls: "text-foreground" },
            { label: "Easy", value: stats.easy, cls: "text-emerald-400" },
            { label: "Medium", value: stats.medium, cls: "text-amber-400" },
            { label: "Hard", value: stats.hard, cls: "text-rose-400" },
            { label: "Free", value: stats.free, cls: "text-primary" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border/60 bg-card/60 p-4"
            >
              <div className={cn("font-display text-2xl font-bold", s.cls)}>
                {catalog ? s.value.toLocaleString() : "—"}
              </div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Company lists — the "Premium" feature, free */}
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-400" />
            <h2 className="font-display text-sm font-semibold">
              Company Lists
              <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                LeetCode Premium — free here
              </span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {topCompanies.map((c) => (
              <button
                key={c}
                onClick={() => setCompany(company === c ? null : c)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  company === c
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                <Building2 className="h-3 w-3" />
                {c}
                <span className="text-[10px] opacity-70">{companyCounts.get(c)}</span>
              </button>
            ))}

            {/* All companies picker */}
            <Popover open={companyPickerOpen} onOpenChange={setCompanyPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-full text-xs"
                >
                  <Search className="h-3 w-3" />
                  All 187 companies
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
                            setCompany(company === c ? null : c);
                            setCompanyPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              company === c ? "opacity-100" : "opacity-0",
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

          {company && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              Showing problems tagged for
              <Badge variant="secondary" className="gap-1">
                {company}
                <button onClick={() => setCompany(null)} aria-label="Clear company">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or number…"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["All", "Easy", "Medium", "Hard"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  difficulty === d
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {d}
              </button>
            ))}

            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="h-9 w-[150px]">
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

            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="number">Sort: Number</SelectItem>
                <SelectItem value="acceptance-desc">Acceptance: High→Low</SelectItem>
                <SelectItem value="acceptance-asc">Acceptance: Low→High</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={freeOnly} onCheckedChange={setFreeOnly} />
              Free only
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={solvableOnly} onCheckedChange={setSolvableOnly} />
              Solvable here
            </label>
          </div>
        </div>

        {/* Loading / error */}
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-300">
            Couldn’t load the catalog: {error}
          </div>
        )}
        {!catalog && !error && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading 3,977 problems…
          </div>
        )}

        {/* Results */}
        {catalog && (
          <>
            <div className="text-xs text-muted-foreground">
              {filtered.length.toLocaleString()} problem
              {filtered.length === 1 ? "" : "s"} match
            </div>

            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">#</th>
                    <th className="px-3 py-2.5 text-left font-medium">Title</th>
                    <th className="hidden px-3 py-2.5 text-left font-medium sm:table-cell">
                      Difficulty
                    </th>
                    <th className="hidden px-3 py-2.5 text-left font-medium md:table-cell">
                      Acceptance
                    </th>
                    <th className="hidden px-3 py-2.5 text-left font-medium lg:table-cell">
                      Companies
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => {
                    const solvable = SOLVABLE_SLUGS.has(p.slug);
                    return (
                      <tr
                        key={p.slug}
                        className="border-t border-border/40 transition-colors hover:bg-muted/30"
                      >
                        <td className="px-3 py-2.5 text-muted-foreground">{p.id}</td>
                        <td className="px-3 py-2.5">
                          <a
                            href={`https://leetcode.com/problems/${p.slug}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground hover:text-primary"
                          >
                            {p.title}
                          </a>
                          {p.paid && (
                            <Crown className="ml-1.5 inline h-3 w-3 text-amber-400" />
                          )}
                          <div className="mt-0.5 flex flex-wrap gap-1 sm:hidden">
                            <span className={cn("text-[11px]", diffColor(p.difficulty))}>
                              {p.difficulty}
                            </span>
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 sm:table-cell">
                          <span className={cn("font-medium", diffColor(p.difficulty))}>
                            {p.difficulty}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">
                          {p.acRate}%
                        </td>
                        <td className="hidden px-3 py-2.5 lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {p.companies.slice(0, 3).map((c) => (
                              <button
                                key={c}
                                onClick={() => setCompany(c)}
                                className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
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
                        <td className="px-3 py-2.5 text-right">
                          {solvable ? (
                            <Button asChild size="sm" className="h-7 gap-1 text-xs">
                              <Link to="/playground" search={{ problem: p.slug }}>
                                <Play className="h-3 w-3" />
                                Solve
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs"
                            >
                              <a
                                href={`https://leetcode.com/problems/${p.slug}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Open
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
