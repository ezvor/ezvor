import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Sparkles, Search, Loader2, History, Briefcase, Compass, MapPin, Clock, Wifi } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { OpportunityCard, type OppCardData, type StatusCitation } from "@/components/OpportunityCard";
import { JobCard } from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OPPORTUNITIES, CATEGORIES, type OppCategory } from "@/data/careerData";
import { discoverOpportunities } from "@/lib/career.functions";
import {
  searchJobs,
  TIMEFRAMES,
  WORK_MODES,
  LOCATIONS,
  SOURCES,
  type JobResult,
} from "@/lib/jobs.functions";
import { getLiveStatuses, getStatusChangeLog, recheckStatus, type LiveStatus } from "@/lib/status.functions";

export const Route = createFileRoute("/opportunities")({
  head: () => ({
    meta: [
      { title: "Job Search & Opportunities — LinkedIn, Indeed, Glassdoor | PathPilot" },
      {
        name: "description",
        content:
          "Search live jobs across LinkedIn, Indeed, Glassdoor and remote boards with time, work-mode and location filters. Plus curated tech programs with source-verified statuses.",
      },
    ],
  }),
  component: OpportunitiesPage,
});

type Filter = "All" | OppCategory;
type Tab = "jobs" | "programs";

function OpportunitiesPage() {
  const [tab, setTab] = useState<Tab>("jobs");

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Live jobs + curated programs"
        title="Opportunities worth your time"
        description="Search real, live job postings across the major platforms, or browse curated tech programs with source-verified statuses."
      >
        <div className="flex gap-2 rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-soft backdrop-blur">
          <TabButton active={tab === "jobs"} onClick={() => setTab("jobs")} icon={<Briefcase className="h-4 w-4" />}>
            Live Jobs
          </TabButton>
          <TabButton
            active={tab === "programs"}
            onClick={() => setTab("programs")}
            icon={<Compass className="h-4 w-4" />}
          >
            Programs & Contests
          </TabButton>
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {tab === "jobs" ? <JobsSearch /> : <ProgramsView />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------- Live Jobs ------------------------------- */

function JobsSearch() {
  const [query, setQuery] = useState("");
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("Any time");
  const [workMode, setWorkMode] = useState<(typeof WORK_MODES)[number]>("Any");
  const [location, setLocation] = useState<(typeof LOCATIONS)[number]>("Pakistan");
  const [activeSources, setActiveSources] = useState<string[]>([...SOURCES]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JobResult[] | null>(null);
  const [searched, setSearched] = useState("");

  const run = useServerFn(searchJobs);

  const toggleSource = (s: string) =>
    setActiveSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const doSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      toast.error("Type a job title, e.g. Associate Software Engineer");
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const res = await run({
        data: {
          query: q,
          timeframe,
          workMode,
          location,
          sources: activeSources.length ? activeSources : undefined,
        },
      });
      setResults(res.jobs);
      setSearched(q);
      if (res.jobs.length === 0) toast.message("No matches — try widening the timeframe or location.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Job search failed");
    } finally {
      setLoading(false);
    }
  };

  const bySource = useMemo(() => {
    const g: Record<string, number> = {};
    for (const j of results ?? []) g[j.source] = (g[j.source] ?? 0) + 1;
    return g;
  }, [results]);

  return (
    <div className="mt-8">
      {/* Search bar */}
      <div className="flex w-full items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-soft backdrop-blur">
        <Search className="ml-2 h-5 w-5 shrink-0 text-primary-glow" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="e.g. Associate Software Engineer, Data Analyst, DevOps Engineer…"
          className="border-0 bg-transparent text-base focus-visible:ring-0"
        />
        <Button onClick={doSearch} disabled={loading} className="shrink-0 bg-gradient-primary shadow-glow">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-4 space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4">
        <FilterRow icon={<Clock className="h-3.5 w-3.5" />} label="Posted">
          {TIMEFRAMES.map((t) => (
            <Pill key={t} active={timeframe === t} onClick={() => setTimeframe(t)}>
              {t}
            </Pill>
          ))}
        </FilterRow>

        <FilterRow icon={<Wifi className="h-3.5 w-3.5" />} label="Work mode">
          {WORK_MODES.map((m) => (
            <Pill key={m} active={workMode === m} onClick={() => setWorkMode(m)}>
              {m}
            </Pill>
          ))}
        </FilterRow>

        <FilterRow icon={<Briefcase className="h-3.5 w-3.5" />} label="Sources">
          {SOURCES.map((s) => (
            <Pill key={s} active={activeSources.includes(s)} onClick={() => toggleSource(s)}>
              {s}
            </Pill>
          ))}
        </FilterRow>

        <FilterRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
          <Select value={location} onValueChange={(v) => setLocation(v as (typeof LOCATIONS)[number])}>
            <SelectTrigger className="h-8 w-56 rounded-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterRow>
      </div>

      {/* Results */}
      {loading && (
        <div className="mt-8 flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching LinkedIn, Indeed, Glassdoor and remote boards…
        </div>
      )}

      {!loading && results && (
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold">
              {results.length} result{results.length === 1 ? "" : "s"} for “{searched}”
            </h2>
            {Object.entries(bySource).map(([s, n]) => (
              <span key={s} className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                {s} · {n}
              </span>
            ))}
          </div>
          {results.length === 0 ? (
            <p className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
              No postings matched. Try “Any time”, switch location to Remote (Worldwide), or enable more sources.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((job, i) => (
                <JobCard key={`${job.url}-${i}`} job={job} />
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Results are pulled live from public job platforms. Always confirm details and apply on the official listing.
          </p>
        </section>
      )}

      {!loading && !results && (
        <div className="mt-10 rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-primary-glow" />
          <p className="mt-3 font-display text-lg font-semibold">Search live jobs across every major platform</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Type a role like “Associate Software Engineer”, pick your filters, and pull fresh postings from LinkedIn,
            Indeed, Glassdoor and top remote boards.
          </p>
        </div>
      )}
    </div>
  );
}

function FilterRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary-glow"
          : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Programs view ----------------------------- */

function ProgramsView() {
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState<OppCardData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, LiveStatus>>({});
  const [rechecking, setRechecking] = useState<Record<string, boolean>>({});

  const discover = useServerFn(discoverOpportunities);
  const fetchStatuses = useServerFn(getLiveStatuses);
  const fetchLog = useServerFn(getStatusChangeLog);
  const recheck = useServerFn(recheckStatus);

  const { data: liveData } = useQuery({
    queryKey: ["live-statuses"],
    queryFn: () => fetchStatuses(),
  });
  const { data: logData } = useQuery({ queryKey: ["status-log"], queryFn: () => fetchLog() });

  const statusMap = useMemo(() => {
    const m: Record<string, LiveStatus> = {};
    for (const s of liveData?.statuses ?? []) m[s.oppId] = s;
    for (const [k, v] of Object.entries(overrides)) m[k] = v;
    return m;
  }, [liveData, overrides]);

  const onRecheck = async (oppId: string) => {
    setRechecking((p) => ({ ...p, [oppId]: true }));
    try {
      const r = await recheck({ data: { oppId } });
      setOverrides((p) => ({
        ...p,
        [oppId]: {
          oppId,
          status: r.status,
          statusNote: r.statusNote,
          sourceUrl: r.sourceUrl,
          sourceTitle: r.sourceTitle,
          reason: r.reason,
          confidence: r.confidence,
          checkedAt: r.checkedAt,
        },
      }));
      toast.success(r.changed ? `Status updated: ${r.oldStatus ?? "?"} → ${r.status}` : `Confirmed: ${r.status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not re-check");
    } finally {
      setRechecking((p) => ({ ...p, [oppId]: false }));
    }
  };

  const merge = (id: string, base: OppCardData): OppCardData => {
    const live = statusMap[id];
    const citation: StatusCitation | undefined = live?.sourceUrl
      ? {
          sourceUrl: live.sourceUrl,
          sourceTitle: live.sourceTitle,
          reason: live.reason,
          confidence: live.confidence,
          checkedAt: live.checkedAt,
        }
      : undefined;
    return {
      ...base,
      status: (live?.status as OppCardData["status"]) ?? base.status,
      statusNote: live?.statusNote ?? base.statusNote,
      citation,
      onRecheck: () => onRecheck(id),
      rechecking: !!rechecking[id],
    };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OPPORTUNITIES.filter((o) => filter === "All" || o.category === filter).filter(
      (o) =>
        !q ||
        o.title.toLowerCase().includes(q) ||
        o.org.toLowerCase().includes(q) ||
        o.field.toLowerCase().includes(q) ||
        o.tags.some((t) => t.includes(q)),
    );
  }, [filter, search]);

  const runDiscover = async () => {
    const q = aiQuery.trim();
    if (!q) return;
    setLoading(true);
    setAiResults(null);
    try {
      const res = await discover({ data: { query: q } });
      setAiResults(res.opportunities);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not fetch opportunities");
    } finally {
      setLoading(false);
    }
  };

  const oppTitle = (id: string) => OPPORTUNITIES.find((o) => o.id === id)?.title ?? id;

  return (
    <>
      <div className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-soft backdrop-blur">
        <Sparkles className="ml-2 h-5 w-5 shrink-0 text-primary-glow" />
        <Input
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runDiscover()}
          placeholder="Discover with AI… e.g. UX design internships"
          className="border-0 bg-transparent focus-visible:ring-0"
        />
        <Button onClick={runDiscover} disabled={loading} className="shrink-0 bg-gradient-primary shadow-glow">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Find
        </Button>
      </div>

      {/* Recent status changes */}
      {logData?.changes && logData.changes.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border/60 bg-card/50 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-bold">
            <History className="h-4 w-4 text-primary-glow" /> Recent status changes
          </h2>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {logData.changes.slice(0, 6).map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1">
                <span className="font-medium text-foreground">{oppTitle(c.opp_id)}</span>
                <span>
                  {c.old_status ?? "—"} → <span className="text-primary-glow">{c.new_status}</span>
                </span>
                <span className="ml-auto">{new Date(c.changed_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(loading || aiResults) && (
        <section className="mt-8">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
            <Sparkles className="h-5 w-5 text-primary-glow" /> AI suggestions
          </h2>
          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching for the best opportunities…
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {aiResults!.map((o, i) => (
                <OpportunityCard key={i} opp={o} />
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            AI-generated suggestions — always confirm details on official sites.
          </p>
        </section>
      )}

      <div className="mt-10 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {(["All", ...CATEGORIES] as Filter[]).map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                filter === c
                  ? "border-primary bg-primary/15 text-primary-glow"
                  : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opportunities…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((opp) => (
          <OpportunityCard key={opp.id} opp={merge(opp.id, opp)} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No opportunities match your filters. Try the AI discovery above.
        </p>
      )}
    </>
  );
}
