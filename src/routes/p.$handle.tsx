import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ShieldCheck,
  Trophy,
  Flame,
  Layers,
  MapPin,
  BadgeCheck,
  ArrowUpRight,
  Rocket,
} from "lucide-react";

import { getPublicProof, type PublicProof } from "@/lib/readiness.functions";
import type { ReadinessPillar } from "@/lib/readiness";
import { ROADMAPS } from "@/data/careerData";

export const Route = createFileRoute("/p/$handle")({
  loader: async ({ params }) => {
    const proof = await getPublicProof({ data: { handle: params.handle } });
    if (!proof) throw notFound();
    return proof;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.displayName || loaderData?.handle || "Ezvor member";
    const role = loaderData?.target?.roleLabel;
    const score = loaderData?.readiness.score;
    const title = role
      ? `${name} — ${score}% ready for ${role} | Ezvor Proof`
      : `${name} | Ezvor Proof`;
    const desc = loaderData?.headline
      ? loaderData.headline
      : `Verified career readiness for ${name}, backed by real solved problems and mastered skills on Ezvor.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ProofPage,
  notFoundComponent: () => (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <ShieldCheck className="h-10 w-10 text-muted-foreground" />
      <h1 className="font-display text-2xl font-bold">This proof page isn't public</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The profile you're looking for doesn't exist or its owner hasn't made it public yet.
      </p>
      <Link
        to="/"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium shadow-glow"
      >
        <Rocket className="h-4 w-4" /> Explore Ezvor
      </Link>
    </div>
  ),
});

const pillarIcons = {
  foundations: Layers,
  dsa: Trophy,
  consistency: Flame,
  proof: ShieldCheck,
} as const;

function diffTone(d: string) {
  const v = d.toLowerCase();
  if (v === "easy") return "text-success";
  if (v === "medium") return "text-warning";
  return "text-destructive";
}

function ProofPage() {
  const proof = Route.useLoaderData() as PublicProof;
  const { readiness } = proof;
  const roadmap = ROADMAPS.find((r) => r.id === proof.target?.roadmapId);
  const name = proof.displayName || proof.handle;

  const size = 168;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-card p-6 sm:p-9"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-7 sm:flex-row sm:items-center sm:gap-9">
          {/* Gauge */}
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="url(#pg)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ - (readiness.score / 100) * circ }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.18 285)" />
                  <stop offset="100%" stopColor="oklch(0.8 0.16 200)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-5xl font-bold tabular-nums">{readiness.score}</span>
              <span className="text-xs text-muted-foreground">/ 100 ready</span>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-1.5 sm:justify-start">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{name}</h1>
              <BadgeCheck className="h-5 w-5 text-primary-glow" />
            </div>
            {proof.headline && <p className="mt-1 text-muted-foreground">{proof.headline}</p>}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground sm:justify-start">
              {proof.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {proof.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-primary-glow">
                {readiness.level}
              </span>
            </div>
            {proof.target && (
              <p className="mt-3 text-sm">
                Targeting{" "}
                <span className="font-semibold text-foreground">{proof.target.roleLabel}</span>
                {proof.target.company ? (
                  <span className="text-muted-foreground"> @ {proof.target.company}</span>
                ) : null}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Pillars */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {readiness.pillars.map((p: ReadinessPillar, i: number) => {
          const Icon = pillarIcons[p.key];
          return (
            <motion.div
              key={p.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="rounded-2xl border border-border/60 bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-4 w-4" /> {p.label}
                </span>
                <span className="font-display text-lg font-bold tabular-nums">{p.score}</span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-gradient-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${p.score}%` }}
                  transition={{ duration: 0.7, delay: 0.2 + i * 0.05 }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Verified stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <StatBox label="Problems solved" value={readiness.stats.solved} />
        <StatBox label="Easy" value={readiness.stats.easy} tone="text-success" />
        <StatBox label="Medium" value={readiness.stats.medium} tone="text-warning" />
        <StatBox label="Hard" value={readiness.stats.hard} tone="text-destructive" />
      </div>

      {/* Recent verified solves */}
      {proof.solved.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 text-success" /> Verified solves
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border/60">
            {proof.solved.slice(0, 12).map((s: PublicProof["solved"][number], i: number) => (
              <div
                key={`${s.problem_title}-${i}`}
                className="flex items-center justify-between gap-3 border-b border-border/50 bg-card px-4 py-3 last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.problem_title}</span>
                {s.topic && (
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {s.topic}
                  </span>
                )}
                <span className={`shrink-0 text-xs font-semibold ${diffTone(s.difficulty)}`}>
                  {s.difficulty}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mastered skills */}
      {roadmap && proof.completedItems.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <Layers className="h-5 w-5 text-primary-glow" /> Skills mastered for {roadmap.role}
          </h2>
          <div className="flex flex-wrap gap-2">
            {proof.completedItems.map((item: string) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium"
              >
                <BadgeCheck className="h-3.5 w-3.5 text-success" /> {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-gradient-card p-8 text-center">
        <p className="font-display text-lg font-semibold">Build your own verifiable proof</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Ezvor scores your real readiness for any tech role and gives you a shareable page recruiters
          can trust. Free, forever.
        </p>
        <Link
          to="/"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-gradient-primary px-5 py-2.5 text-sm font-medium shadow-glow"
        >
          Start on Ezvor <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
      <p className={`font-display text-2xl font-bold tabular-nums ${tone ?? ""}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
