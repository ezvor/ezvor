import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  Layout,
  Server,
  BarChart3,
  BrainCircuit,
  Cloud,
  ShieldCheck,
  GitBranch,
  Trophy,
  Layers,
  Bug,
  LineChart,
  Database,
  Boxes,
  Bot,
  Smartphone,
  Palette,
  CloudCog,
  DatabaseZap,
  Network,
  Briefcase,
  Gamepad2,
  Blocks,
  Binary,
  Workflow,
  ListTree,
  MousePointerClick,
  Map as MapIcon,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { RoadmapGraph } from "@/components/RoadmapGraph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROADMAPS, type Roadmap } from "@/data/careerData";
import { GRAPH_ROADMAPS, type GraphRoadmap } from "@/data/graphData";
import { getDocLink } from "@/data/roadmapDocs";
import { generateRoadmap, generatePersonalGraph } from "@/lib/career.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/roadmaps")({
  head: () => ({
    meta: [
      { title: "Roadmaps & Skill Graphs: Visual Career Paths | Ezvor" },
      {
        name: "description",
        content:
          "One place for every tech career path on Ezvor: explore interactive NeetCode-style skill graphs or step-by-step checklists with free resources, or generate a personalized path with AI.",
      },
    ],
  }),
  component: RoadmapsPage,
});

const iconMap: Record<string, LucideIcon> = {
  Layout,
  Server,
  BarChart3,
  BrainCircuit,
  Cloud,
  ShieldCheck,
  GitBranch,
  Trophy,
  Layers,
  Bug,
  LineChart,
  Database,
  Boxes,
  Bot,
  Smartphone,
  Palette,
  CloudCog,
  DatabaseZap,
  Network,
  Briefcase,
  Gamepad2,
  Blocks,
  Binary,
  Sparkles,
};

/** Roadmap ids that also have a rich interactive graph, so we can cross-link the two views. */
const GRAPH_BY_ROLE_ID: Record<string, string> = {
  frontend: "frontend",
  "data-scientist": "data-science",
  devops: "devops",
  "open-source": "open-source",
  "competitive-programmer": "dsa",
};

function RoadmapView({ roadmap, icon }: { roadmap: Roadmap; icon: LucideIcon }) {
  const Icon = icon;
  return (
    <div className="group/card rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-soft transition-all hover:border-primary/40 hover:shadow-glow">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary-glow">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold">{roadmap.role}</h3>
          <p className="text-xs text-muted-foreground">{roadmap.duration}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{roadmap.summary}</p>

      <div className="mt-5 space-y-4">
        {roadmap.stages.map((stage, i) => (
          <div key={i} className="relative pl-7">
            <span className="absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-bold text-primary-foreground">
              {i + 1}
            </span>
            {i < roadmap.stages.length - 1 && (
              <span className="absolute left-[9px] top-6 h-[calc(100%-1rem)] w-px bg-border" />
            )}
            <p className="text-sm font-semibold">{stage.title}</p>
            <ul className="mt-1.5 space-y-1">
              {stage.items.map((item) => (
                <li key={item}>
                  <a
                    href={getDocLink(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary-glow/70 transition-colors group-hover:text-primary-glow" />
                    <span className="underline-offset-4 group-hover:underline">{item}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

type Mode = "graph" | "list";

function RoadmapsPage() {
  const [mode, setMode] = useState<Mode>("graph");
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(false);

  // Graph view state
  const [activeId, setActiveId] = useState(GRAPH_ROADMAPS[0].id);
  const [personalGraph, setPersonalGraph] = useState<GraphRoadmap | null>(null);

  // List view state
  const [generatedList, setGeneratedList] = useState<Roadmap | null>(null);

  const genGraph = useServerFn(generatePersonalGraph);
  const genList = useServerFn(generateRoadmap);

  const activeGraph = useMemo(
    () =>
      personalGraph && activeId === "personal"
        ? personalGraph
        : GRAPH_ROADMAPS.find((g) => g.id === activeId) ?? GRAPH_ROADMAPS[0],
    [personalGraph, activeId],
  );

  const run = async () => {
    const r = role.trim();
    if (!r) {
      toast.error("Enter a target role first");
      return;
    }
    setLoading(true);
    try {
      if (mode === "graph") {
        const res = await genGraph({ data: { role: r, skills: skills.trim() || undefined } });
        setPersonalGraph(res);
        setActiveId("personal");
        toast.success("Your personalized skill graph is ready");
      } else {
        const res = await genList({ data: { goal: r } });
        setGeneratedList({ id: "ai", icon: "MapIcon", ...res });
        toast.success("Your personalized roadmap is ready");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Roadmaps · Skill graphs · AI generated"
        title="Every path to hired, in one place"
        description="Explore proven paths as interactive skill graphs or step-by-step checklists — every node and step links hand-picked free resources. Or describe your goal and let AI build one for you."
      >
        <div className="w-full max-w-2xl space-y-3">
          {/* View switch */}
          <div className="mx-auto inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1 shadow-soft backdrop-blur">
            <button
              onClick={() => setMode("graph")}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                mode === "graph"
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Workflow className="h-4 w-4" /> Skill graph
            </button>
            <button
              onClick={() => setMode("list")}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                mode === "list"
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListTree className="h-4 w-4" /> Checklist
            </button>
          </div>

          {/* AI generator */}
          <div className="space-y-2 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-soft backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && mode === "graph" && run()}
                placeholder="Target role… e.g. Data Architect, DevOps, AI Engineer"
                className="flex-1"
              />
              <Button onClick={run} disabled={loading} className="shrink-0 bg-gradient-primary shadow-glow">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {mode === "graph" ? "Generate graph" : "Build roadmap"}
              </Button>
            </div>
            {mode === "graph" && (
              <Input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="Your current skills (optional)… e.g. Python, SQL, basic stats"
              />
            )}
          </div>
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {mode === "graph" ? (
          <>
            <div className="mt-8 flex flex-wrap gap-2">
              {personalGraph && (
                <button
                  onClick={() => setActiveId("personal")}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all",
                    activeId === "personal"
                      ? "border-primary bg-primary/15 text-primary-glow shadow-glow"
                      : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  {personalGraph.title}
                </button>
              )}
              {GRAPH_ROADMAPS.map((g) => {
                const Icon = iconMap[g.icon] ?? Binary;
                const isActive = g.id === activeId;
                return (
                  <button
                    key={g.id}
                    onClick={() => setActiveId(g.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all",
                      isActive
                        ? "border-primary bg-primary/15 text-primary-glow shadow-glow"
                        : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {g.title}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-3xl border border-border/60 bg-gradient-hero p-5 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold sm:text-2xl">{activeGraph.title}</h2>
                  <p className="text-sm text-muted-foreground">{activeGraph.tagline}</p>
                </div>
                <span className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground sm:flex">
                  <MousePointerClick className="h-3.5 w-3.5" /> Click a node
                </span>
              </div>

              <div className="mt-8">
                <RoadmapGraph key={activeGraph.id} graph={activeGraph} />
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Prefer a linear checklist? Switch to{" "}
              <button onClick={() => setMode("list")} className="text-primary-glow underline-offset-4 hover:underline">
                Checklist view
              </button>
              . Progress is saved for this session · all resources are 100% free.
            </p>
          </>
        ) : (
          <>
            {(loading || generatedList) && (
              <section className="mt-8">
                <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
                  <Sparkles className="h-5 w-5 text-primary-glow" /> Your AI roadmap
                </h2>
                {loading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Designing your path…
                  </div>
                ) : (
                  <div className="max-w-xl">
                    <RoadmapView roadmap={generatedList!} icon={MapIcon} />
                  </div>
                )}
              </section>
            )}

            <h2 className="mt-12 font-display text-2xl font-bold">All roadmaps</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ROADMAPS.length} career paths across every IT domain. Tap any skill to open free documentation.
            </p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {ROADMAPS.map((r) => {
                const graphId = GRAPH_BY_ROLE_ID[r.id];
                return (
                  <div key={r.id} className="relative">
                    <RoadmapView roadmap={r} icon={iconMap[r.icon] ?? MapIcon} />
                    {graphId && (
                      <button
                        onClick={() => {
                          setActiveId(graphId);
                          setMode("graph");
                        }}
                        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary-glow transition-all hover:bg-primary/20"
                      >
                        <Workflow className="h-3 w-3" /> View as graph
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
