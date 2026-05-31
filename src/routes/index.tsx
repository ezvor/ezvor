import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Compass,
  Map as MapIcon,
  BookOpen,
  Sparkles,
  ArrowRight,
  Send,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OPPORTUNITIES, ROADMAPS, RESOURCES, CATEGORIES } from "@/data/careerData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PathPilot — Your Free AI Career Copilot" },
      {
        name: "description",
        content:
          "Personalized AI career guidance, learning roadmaps, free resources, and curated opportunities (GSoC, LFX, ICPC, Meta Hacker Cup, and more).",
      },
    ],
  }),
  component: Dashboard,
});

const stats = [
  { label: "Opportunities", value: OPPORTUNITIES.length + "+", icon: Compass },
  { label: "Roadmaps", value: ROADMAPS.length + "+", icon: MapIcon },
  { label: "Free resources", value: RESOURCES.length + "+", icon: BookOpen },
  { label: "Categories", value: String(CATEGORIES.length), icon: TrendingUp },
];

function Dashboard() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");

  const ask = () => {
    const q = prompt.trim();
    navigate({ to: "/advisor", search: q ? { q } : undefined });
  };

  const featured = OPPORTUNITIES.slice(0, 6);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Free · AI-powered · No sign-up"
        title="Navigate your tech career with an AI copilot"
        description="Get high-accuracy, personalized guidance plus curated opportunities, roadmaps, and free resources — all in one place."
      >
        <div className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-soft backdrop-blur">
          <Sparkles className="ml-2 h-5 w-5 shrink-0 text-primary-glow" />
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask anything… e.g. How do I get into GSoC?"
            className="border-0 bg-transparent focus-visible:ring-0"
          />
          <Button onClick={ask} className="shrink-0 bg-gradient-primary shadow-glow">
            <Send className="h-4 w-4" /> Ask
          </Button>
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* Stats */}
        <div className="-mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border/60 bg-gradient-card p-4 shadow-soft"
            >
              <s.icon className="h-5 w-5 text-primary-glow" />
              <p className="mt-3 font-display text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              to: "/opportunities",
              title: "Explore Opportunities",
              desc: "GSoC, LFX, ICPC, hackathons, internships & more.",
              icon: Compass,
            },
            {
              to: "/roadmaps",
              title: "Follow a Roadmap",
              desc: "Step-by-step paths or generate one with AI.",
              icon: MapIcon,
            },
            {
              to: "/resources",
              title: "Learn for Free",
              desc: "Hand-picked free courses, practice & docs.",
              icon: BookOpen,
            },
          ].map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-2xl border border-border/60 bg-card p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-elegant"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary-glow">
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 flex items-center gap-1 font-display text-lg font-semibold">
                {c.title}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            </Link>
          ))}
        </div>

        {/* Featured opportunities */}
        <div className="mt-12 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Featured opportunities</h2>
            <p className="text-sm text-muted-foreground">
              High-impact programs worth applying to right now.
            </p>
          </div>
          <Link
            to="/opportunities"
            className="hidden items-center gap-1 text-sm text-primary-glow hover:underline sm:flex"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((opp) => (
            <OpportunityCard key={opp.id} opp={opp} />
          ))}
        </div>
      </div>
    </div>
  );
}
