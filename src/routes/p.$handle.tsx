import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Flame,
  Github,
  Layers,
  Linkedin,
  Link2,
  MapPin,
  Rocket,
  ShieldCheck,
  Target,
  Trophy,
  UserX,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SITE, absoluteUrl } from "@/config/site";
import { ROADMAPS } from "@/data/careerData";
import { getPublicProof, type PublicProof } from "@/lib/readiness.functions";
import { githubUrl, linkedinUrl, type ReadinessPillar } from "@/lib/readiness";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/p/$handle")({
  loader: async ({ params }) => {
    const proof = await getPublicProof({ data: { handle: params.handle } });
    if (!proof) throw notFound();
    return proof;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: `Profile not found | ${SITE.name}` },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const name = loaderData.displayName || loaderData.handle;
    const { total } = loaderData.counts;
    const title = `${name} (@${loaderData.handle}) · ${SITE.name}`;
    const desc =
      loaderData.headline ||
      `${name} has solved ${total} coding problem${total === 1 ? "" : "s"} on ${SITE.name}, each verified by the judge.${
        loaderData.target ? ` Targeting ${loaderData.target.roleLabel}.` : ""
      }`;
    const url = absoluteUrl(`/p/${params.handle}`);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:type", content: "profile" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "profile:username", content: loaderData.handle },
        ...(loaderData.avatarUrl ? [{ property: "og:image", content: loaderData.avatarUrl }] : []),
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ProfilePage,
  notFoundComponent: () => (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <UserX className="h-10 w-10 text-muted-foreground" />
      <h1 className="font-display text-2xl font-bold">This profile isn't available</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        It doesn't exist, or its owner hasn't made it public.
      </p>
      <Button asChild className="mt-2 gap-1.5 bg-gradient-primary shadow-glow">
        <Link to="/">
          <Rocket className="h-4 w-4" /> Explore {SITE.name}
        </Link>
      </Button>
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
  if (v.startsWith("e")) return "text-success";
  if (v.startsWith("m")) return "text-warning";
  return "text-destructive";
}

const fmtMonth = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  if (s < 30 * 86_400) return `${Math.round(s / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProfilePage() {
  const proof = Route.useLoaderData() as PublicProof;
  const { readiness, counts } = proof;
  const roadmap = ROADMAPS.find((r) => r.id === proof.target?.roadmapId);
  const name = proof.displayName || proof.handle;
  const initials =
    name
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "E";
  const activeDays = Object.keys(proof.solvedDays).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-card p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar className="h-24 w-24 shrink-0 border-2 border-primary/40 shadow-glow">
            {proof.avatarUrl && <AvatarImage src={proof.avatarUrl} alt={name} />}
            <AvatarFallback className="bg-gradient-primary font-display text-2xl text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{name}</h1>
              <span className="text-sm text-muted-foreground">@{proof.handle}</span>
            </div>
            {proof.headline && <p className="mt-1 text-foreground/90">{proof.headline}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              {proof.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {proof.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Joined {fmtMonth(proof.memberSince)}
              </span>
              {proof.github && (
                <a
                  href={githubUrl(proof.github)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Github className="h-3.5 w-3.5" /> {proof.github}
                </a>
              )}
              {proof.linkedin && (
                <a
                  href={linkedinUrl(proof.linkedin)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                </a>
              )}
            </div>

            {proof.bio && (
              <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {proof.bio}
              </p>
            )}
          </div>

          <ShareButton handle={proof.handle} />
        </div>
      </motion.section>

      {/* Solved summary */}
      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-success" /> Verified solves
          </h2>
          <div className="mt-4 flex items-center gap-5">
            <DifficultyRing easy={counts.easy} medium={counts.medium} hard={counts.hard} />
            <div className="flex-1 space-y-2.5">
              <DiffBar label="Easy" value={counts.easy} total={counts.total} tone="bg-success" />
              <DiffBar
                label="Medium"
                value={counts.medium}
                total={counts.total}
                tone="bg-warning"
              />
              <DiffBar
                label="Hard"
                value={counts.hard}
                total={counts.total}
                tone="bg-destructive"
              />
            </div>
          </div>
          {proof.topics.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {proof.topics.map((t) => (
                <span
                  key={t.topic}
                  className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {t.topic} <span className="font-semibold text-foreground">{t.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Flame className="h-4 w-4 text-warning" /> Solving activity
            </h2>
            <span className="text-xs text-muted-foreground">
              {activeDays} active day{activeDays === 1 ? "" : "s"} this year
            </span>
          </div>
          <Heatmap days={proof.solvedDays} />
        </div>
      </section>

      {/* Readiness (only when they chose a target) */}
      {proof.target && (
        <section className="mt-6 rounded-2xl border border-border/60 bg-gradient-card p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ScoreRing value={readiness.score} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Target className="h-3.5 w-3.5" /> Readiness for
              </p>
              <h2 className="mt-0.5 font-display text-xl font-bold">
                {proof.target.roleLabel}
                {proof.target.company ? (
                  <span className="text-muted-foreground"> @ {proof.target.company}</span>
                ) : null}
              </h2>
              <span className="mt-2 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary-glow">
                {readiness.level}
              </span>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {readiness.pillars.map((p: ReadinessPillar) => {
                  const Icon = pillarIcons[p.key];
                  return (
                    <div
                      key={p.key}
                      className="rounded-lg border border-border/60 bg-background/40 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" /> {p.label}
                        </span>
                        <span className="text-sm font-bold tabular-nums">{p.score}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-primary"
                          style={{ width: `${p.score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {roadmap && proof.completedItems.length > 0 && (
            <div className="mt-5 border-t border-border/50 pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Skills marked mastered for {roadmap.role}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {proof.completedItems.slice(0, 40).map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium"
                  >
                    <BadgeCheck className="h-3 w-3 text-success" /> {item}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Skills are self-reported; solved problems are verified by the judge.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Recent solves */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <Trophy className="h-5 w-5 text-primary-glow" /> Recent solves
        </h2>
        {proof.recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No verified solves yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60">
            {proof.recent.map((s) => (
              <Link
                key={s.slug}
                to="/playground"
                search={{ problem: s.slug }}
                className="flex items-center gap-3 border-b border-border/50 bg-card px-4 py-3 transition-colors last:border-0 hover:bg-secondary/40"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-label="Verified" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.title}</span>
                {s.topic && (
                  <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
                    {s.topic}
                  </span>
                )}
                {s.language && (
                  <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                    {s.language}
                  </span>
                )}
                <span
                  className={cn(
                    "w-14 shrink-0 text-right text-xs font-semibold",
                    diffTone(s.difficulty),
                  )}
                >
                  {s.difficulty}
                </span>
                <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:inline">
                  {timeAgo(s.solvedAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Footer CTA */}
      <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-gradient-card p-8 text-center">
        <p className="font-display text-lg font-semibold">Build your own verified profile</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Practice on {SITE.name}: every accepted solution is checked by the judge and added to a
          public page you can share with recruiters. Free, forever.
        </p>
        <Button asChild className="mt-1 gap-1.5 bg-gradient-primary shadow-glow">
          <Link to="/">
            Start on {SITE.name} <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ShareButton({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/p/${handle}`
        : absoluteUrl(`/p/${handle}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <Button
      variant="secondary"
      size="sm"
      className="shrink-0 gap-1.5 self-start"
      onClick={() => void share()}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

function DiffBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DifficultyRing({ easy, medium, hard }: { easy: number; medium: number; hard: number }) {
  const total = easy + medium + hard;
  const size = 112;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const segs = [
    { v: easy, c: "var(--color-success, oklch(0.72 0.17 150))" },
    { v: medium, c: "var(--color-warning, oklch(0.8 0.15 80))" },
    { v: hard, c: "var(--color-destructive, oklch(0.65 0.2 25))" },
  ];
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        {total > 0 &&
          segs.map((s, i) => {
            const len = (s.v / total) * circ;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.c}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold tabular-nums">{total}</span>
        <span className="text-[11px] text-muted-foreground">solved</span>
      </div>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const size = 112;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0 self-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#profileScore)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circ} ${circ}`}
        />
        <defs>
          <linearGradient id="profileScore" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.7 0.18 285)" />
            <stop offset="100%" stopColor="oklch(0.8 0.16 200)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold tabular-nums">{value}</span>
        <span className="text-[11px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

/** 26-week grid of first-solve days (UTC), GitHub-style. */
function Heatmap({ days }: { days: Record<string, number> }) {
  const weeks = useMemo(() => {
    const WEEKS = 26;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (WEEKS * 7 - 1) - start.getUTCDay());
    const cols: { key: string; count: number; future: boolean }[][] = [];
    const cursor = new Date(start);
    for (let w = 0; w <= WEEKS; w++) {
      const col: { key: string; count: number; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const key = cursor.toISOString().slice(0, 10);
        col.push({ key, count: days[key] ?? 0, future: cursor > today });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      cols.push(col);
    }
    return cols;
  }, [days]);

  const tone = (n: number) =>
    n === 0 ? "bg-muted/60" : n === 1 ? "bg-primary/35" : n <= 3 ? "bg-primary/60" : "bg-primary";

  return (
    <div className="mt-4 overflow-x-auto pb-1">
      <div
        className="flex w-max gap-[3px]"
        role="img"
        aria-label="Solving activity over the last six months"
      >
        {weeks.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((c) => (
              <span
                key={c.key}
                title={c.future ? undefined : `${c.count} solved · ${c.key}`}
                className={cn("h-3 w-3 rounded-[3px]", c.future ? "opacity-0" : tone(c.count))}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
