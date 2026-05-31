import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Binary,
  Layout,
  BarChart3,
  Cloud,
  GitBranch,
  MousePointerClick,
  Sparkles,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { RoadmapGraph } from "@/components/RoadmapGraph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRAPH_ROADMAPS, type GraphRoadmap } from "@/data/graphData";
import { generatePersonalGraph } from "@/lib/career.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Interactive Skill Graphs — Visual Roadmaps | PathPilot" },
      {
        name: "description",
        content:
          "Explore NeetCode-style interactive roadmap graphs, or generate a personalized one from your current skills and target role — each node links hand-picked free YouTube resources.",
      },
    ],
  }),
  component: GraphPage,
});

const iconMap: Record<string, LucideIcon> = { Binary, Layout, BarChart3, Cloud, GitBranch, Sparkles };

function GraphPage() {
  const [activeId, setActiveId] = useState(GRAPH_ROADMAPS[0].id);
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(false);
  const [personal, setPersonal] = useState<GraphRoadmap | null>(null);

  const generate = useServerFn(generatePersonalGraph);

  const active = personal && activeId === "personal" ? personal : GRAPH_ROADMAPS.find((g) => g.id === activeId)!;

  const run = async () => {
    const r = role.trim();
    if (!r) {
      toast.error("Enter a target role first");
      return;
    }
    setLoading(true);
    try {
      const res = await generate({ data: { role: r, skills: skills.trim() || undefined } });
      setPersonal(res);
      setActiveId("personal");
      toast.success("Your personalized graph is ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate graph");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Interactive · Personalized · Free"
        title="Skill graphs you can explore"
        description="Generate a roadmap from your skills and target role, or explore proven NeetCode-style paths. Tap any node for hand-picked free resources."
      >
        <div className="w-full max-w-2xl space-y-2 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-soft backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Target role… e.g. Data Architect, DevOps, Data Scientist"
              className="flex-1"
            />
            <Button onClick={run} disabled={loading} className="shrink-0 bg-gradient-primary shadow-glow">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate my graph
            </Button>
          </div>
          <Input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Your current skills (optional)… e.g. Python, SQL, basic stats"
          />
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        <div className="mt-8 flex flex-wrap gap-2">
          {personal && (
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
              {personal.title}
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
              <h2 className="font-display text-xl font-bold sm:text-2xl">{active.title}</h2>
              <p className="text-sm text-muted-foreground">{active.tagline}</p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground sm:flex">
              <MousePointerClick className="h-3.5 w-3.5" /> Click a node
            </span>
          </div>

          <div className="mt-8">
            <RoadmapGraph key={active.id} graph={active} />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Progress is saved for this session. All linked resources are 100% free.
        </p>
      </div>
    </div>
  );
}
