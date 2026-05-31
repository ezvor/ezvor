import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
  Map as MapIcon,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROADMAPS, type Roadmap } from "@/data/careerData";
import { generateRoadmap } from "@/lib/career.functions";

export const Route = createFileRoute("/roadmaps")({
  head: () => ({
    meta: [
      { title: "Career Roadmaps — Step-by-Step Tech Paths | PathPilot" },
      {
        name: "description",
        content:
          "Follow proven roadmaps for frontend, backend, data science, ML, DevOps, cybersecurity, open source and competitive programming — or generate a custom one with AI.",
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
};

function RoadmapView({ roadmap, icon }: { roadmap: Roadmap; icon: LucideIcon }) {
  const Icon = icon;
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-soft">
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
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success/70" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoadmapsPage() {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<Roadmap | null>(null);
  const generate = useServerFn(generateRoadmap);

  const run = async () => {
    const g = goal.trim();
    if (!g) return;
    setLoading(true);
    setGenerated(null);
    try {
      const res = await generate({ data: { goal: g } });
      setGenerated({ id: "ai", icon: "MapIcon", ...res });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate roadmap");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Curated + AI generated"
        title="Roadmaps that get you hired"
        description="Pick a proven path, or describe any goal and let AI build a personalized step-by-step roadmap."
      >
        <div className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-soft backdrop-blur">
          <Sparkles className="ml-2 h-5 w-5 shrink-0 text-primary-glow" />
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Generate a roadmap… e.g. AI Product Manager"
            className="border-0 bg-transparent focus-visible:ring-0"
          />
          <Button onClick={run} disabled={loading} className="shrink-0 bg-gradient-primary shadow-glow">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Build
          </Button>
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {(loading || generated) && (
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
                <RoadmapView roadmap={generated!} icon={MapIcon} />
              </div>
            )}
          </section>
        )}

        <h2 className="mt-12 font-display text-2xl font-bold">Popular roadmaps</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {ROADMAPS.map((r) => (
            <RoadmapView key={r.id} roadmap={r} icon={iconMap[r.icon] ?? MapIcon} />
          ))}
        </div>
      </div>
    </div>
  );
}
