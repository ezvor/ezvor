import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Sparkles, Search, Loader2, History } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { OpportunityCard, type OppCardData, type StatusCitation } from "@/components/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OPPORTUNITIES, CATEGORIES, type OppCategory } from "@/data/careerData";
import { discoverOpportunities } from "@/lib/career.functions";
import { getLiveStatuses, getStatusChangeLog, recheckStatus, type LiveStatus } from "@/lib/status.functions";

export const Route = createFileRoute("/opportunities")({
  head: () => ({
    meta: [
      { title: "Opportunities — GSoC, LFX, ICPC & More | PathPilot" },
      {
        name: "description",
        content:
          "Browse curated tech opportunities with live, source-verified application statuses. Open-source mentorships, contests, hackathons, internships, scholarships and fellowships.",
      },
    ],
  }),
  component: OpportunitiesPage,
});

type Filter = "All" | OppCategory;

function OpportunitiesPage() {
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
    <div className="pb-16">
      <PageHeader
        eyebrow="Curated + AI discovery + live status"
        title="Opportunities worth your time"
        description="Real programs with source-verified application statuses — see exactly why each is Open, Closed or Rolling."
      >
        <div className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-soft backdrop-blur">
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
      </PageHeader>

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
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
      </div>
    </div>
  );
}
