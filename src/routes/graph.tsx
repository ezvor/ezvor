import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Binary,
  Layout,
  BarChart3,
  Cloud,
  GitBranch,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { RoadmapGraph } from "@/components/RoadmapGraph";
import { GRAPH_ROADMAPS } from "@/data/graphData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Interactive Skill Graphs — Visual Roadmaps | PathPilot" },
      {
        name: "description",
        content:
          "Explore NeetCode-style interactive roadmap graphs for DSA, frontend, data science, DevOps and open source. Click any node for hand-picked free YouTube resources.",
      },
    ],
  }),
  component: GraphPage,
});

const iconMap: Record<string, LucideIcon> = {
  Binary,
  Layout,
  BarChart3,
  Cloud,
  GitBranch,
};

function GraphPage() {
  const [activeId, setActiveId] = useState(GRAPH_ROADMAPS[0].id);
  const active = GRAPH_ROADMAPS.find((g) => g.id === activeId)!;

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Interactive · Expandable · Free"
        title="Skill graphs you can explore"
        description="A living, NeetCode-style map of every path. Tap a node to expand hand-picked free resources and track your progress."
      />

      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        {/* selector */}
        <div className="mt-8 flex flex-wrap gap-2">
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
