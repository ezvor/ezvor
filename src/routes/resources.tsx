import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Dumbbell, FileText, Map, Users, Youtube } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RESOURCES, type Resource } from "@/data/careerData";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Free Learning Resources for Tech | PathPilot" },
      {
        name: "description",
        content:
          "Hand-picked free resources to learn coding, DSA, data science, ML, cybersecurity and open source — from freeCodeCamp and CS50 to LeetCode and roadmap.sh.",
      },
    ],
  }),
  component: ResourcesPage,
});

const typeIcon = {
  Course: BookOpen,
  Practice: Dumbbell,
  Docs: FileText,
  Roadmap: Map,
  Community: Users,
  Video: Youtube,
} as const;

function ResourcesPage() {
  const topics = useMemo(() => ["All", ...new Set(RESOURCES.map((r) => r.topic))], []);
  const [topic, setTopic] = useState("All");

  const filtered = RESOURCES.filter((r) => topic === "All" || r.topic === topic);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="100% free"
        title="Learn for free, learn well"
        description="A curated shelf of the best free resources to build real, job-ready skills."
      />

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="mt-8 flex flex-wrap gap-2">
          {topics.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                topic === t
                  ? "border-primary bg-primary/15 text-primary-glow"
                  : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ResourceCard key={r.id} r={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourceCard({ r }: { r: Resource }) {
  const Icon = typeIcon[r.type];
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-elegant"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary-glow">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold leading-snug">{r.title}</h3>
      <p className="text-sm text-muted-foreground">{r.provider}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-full text-[11px] font-normal">
          {r.type}
        </Badge>
        <Badge variant="outline" className="rounded-full text-[11px] font-normal">
          {r.topic}
        </Badge>
        {r.free && (
          <Badge
            variant="outline"
            className="rounded-full border-success/30 bg-success/15 text-[11px] font-normal text-success"
          >
            Free
          </Badge>
        )}
      </div>
    </a>
  );
}
