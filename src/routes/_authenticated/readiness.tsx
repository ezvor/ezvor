import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, animate } from "motion/react";
import {
  Target,
  Trophy,
  Flame,
  ShieldCheck,
  Layers,
  Zap,
  ArrowRight,
  Check,
  Globe,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROADMAPS } from "@/data/careerData";
import { computeReadiness, type SolvedRow } from "@/lib/readiness";
import {
  getProgress,
  getMyProfile,
  setTarget,
  toggleRoadmapItem,
  updateProfile,
} from "@/lib/readiness.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/readiness")({
  head: () => ({
    meta: [
      { title: "Readiness Engine — Am I hireable yet? | Ezvor" },
      {
        name: "description",
        content:
          "An honest, calibrated readiness score for your target role, built from verified proof — problems you've solved and skills you've mastered — with the highest-impact next moves.",
      },
    ],
  }),
  component: ReadinessPage,
});

const pillarIcons = {
  foundations: Layers,
  dsa: Trophy,
  consistency: Flame,
  proof: ShieldCheck,
} as const;

function ReadinessPage() {
  const progressFn = useServerFn(getProgress);
  const profileFn = useServerFn(getMyProfile);
  const setTargetFn = useServerFn(setTarget);
  const toggleFn = useServerFn(toggleRoadmapItem);
  const updateProfileFn = useServerFn(updateProfile);

  const progressQuery = useQuery({ queryKey: ["readiness-progress"], queryFn: () => progressFn() });
  const profileQuery = useQuery({ queryKey: ["readiness-profile"], queryFn: () => profileFn() });

  // Local, optimistic state so the score reacts instantly as you check skills.
  const [roadmapId, setRoadmapId] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [solved, setSolved] = useState<SolvedRow[]>([]);
  const seeded = useRef(false);

  useEffect(() => {
    if (!progressQuery.data || seeded.current) return;
    seeded.current = true;
    const d = progressQuery.data;
    setRoadmapId(d.target?.roadmapId ?? "");
    setCompany(d.target?.company ?? "");
    setCompleted(new Set(d.completedItems));
    setSolved(d.solved.map((s) => ({ difficulty: s.difficulty, solved_at: s.solved_at })));
  }, [progressQuery.data]);

  const roadmap = useMemo(() => ROADMAPS.find((r) => r.id === roadmapId), [roadmapId]);
  const readiness = useMemo(
    () => computeReadiness(roadmap, solved, completed),
    [roadmap, solved, completed],
  );

  const chooseTarget = (id: string) => {
    const r = ROADMAPS.find((x) => x.id === id);
    if (!r) return;
    setRoadmapId(id);
    setTargetFn({ data: { roadmapId: id, roleLabel: r.role, company: company || null } }).catch(() =>
      toast.error("Couldn't save target"),
    );
  };

  const saveCompany = () => {
    if (!roadmap) return;
    setTargetFn({ data: { roadmapId: roadmap.id, roleLabel: roadmap.role, company: company || null } })
      .then(() => toast.success("Target company saved"))
      .catch(() => toast.error("Couldn't save"));
  };

  const toggleItem = (stageTitle: string, item: string) => {
    if (!roadmap) return;
    const willComplete = !completed.has(item);
    setCompleted((prev) => {
      const next = new Set(prev);
      if (willComplete) next.add(item);
      else next.delete(item);
      return next;
    });
    toggleFn({
      data: { roadmapId: roadmap.id, stageTitle, item, done: willComplete },
    }).catch(() => toast.error("Couldn't sync progress"));
  };

  const loading = progressQuery.isLoading;

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow="Readiness Engine"
        title="Am I actually good enough — yet?"
        description="A brutally honest, calibrated score for your target role, built only from verified proof: problems you've solved here and skills you've mastered. No vanity counts."
      />

      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        {/* Target selector */}
        <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-border/60 bg-gradient-card p-5 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <Target className="h-4 w-4 text-primary-glow" /> Your target role
            </label>
            <Select value={roadmapId} onValueChange={chooseTarget}>
              <SelectTrigger className="bg-card/70">
                <SelectValue placeholder="Choose the role you're aiming for…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {ROADMAPS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Target company (optional)
            </label>
            <div className="flex gap-2">
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Google, Systems Limited"
                className="bg-card/70"
              />
              <Button variant="secondary" onClick={saveCompany} disabled={!roadmap}>
                Save
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Reading your verified activity…
          </div>
        ) : !roadmap ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-12 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary-glow" />
            <p className="mt-3 font-display text-lg font-semibold">Pick a target to unlock your score</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Your readiness is scored against a specific role. Choose one above and it updates live as
              you master skills and solve problems.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* LEFT: score + moves + skills */}
            <div className="space-y-6">
              <ScoreCard readiness={readiness} roleLabel={roadmap.role} company={company} />

              {/* Next moves */}
              <div>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                  <Zap className="h-5 w-5 text-primary-glow" /> Your highest-impact next moves
                </h2>
                <div className="grid gap-3">
                  {readiness.moves.map((m, i) => (
                    <motion.div
                      key={m.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 font-display text-sm font-bold text-primary-glow">
                        +{m.impact}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{m.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.detail}</p>
                      </div>
                      {m.ctaTo === "/playground" ? (
                        <Link to="/playground">
                          <Button size="sm" variant="secondary" className="shrink-0">
                            {m.ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0"
                          onClick={() =>
                            document
                              .getElementById(m.ctaTo === "/readiness" ? "skills" : "publish")
                              ?.scrollIntoView({ behavior: "smooth" })
                          }
                        >
                          {m.ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                  {readiness.moves.length === 0 && (
                    <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm text-success">
                      You've maxed every pillar for this target. Go apply and interview.
                    </div>
                  )}
                </div>
              </div>

              {/* Skill checklist */}
              <div id="skills">
                <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
                  <Layers className="h-5 w-5 text-primary-glow" /> {roadmap.role} skills
                </h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Check off what you can genuinely do. {readiness.stats.itemsDone}/
                  {readiness.stats.itemsTotal} mastered.
                </p>
                <div className="space-y-4">
                  {roadmap.stages.map((stage) => (
                    <div key={stage.title} className="rounded-xl border border-border/60 bg-card/60 p-4">
                      <p className="mb-3 text-sm font-semibold text-muted-foreground">{stage.title}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {stage.items.map((item) => {
                          const done = completed.has(item);
                          return (
                            <button
                              key={item}
                              onClick={() => toggleItem(stage.title, item)}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-all",
                                done
                                  ? "border-success/50 bg-success/10 text-foreground"
                                  : "border-border/60 bg-background/40 hover:border-primary/40",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors",
                                  done
                                    ? "border-success bg-success text-success-foreground"
                                    : "border-muted-foreground/40",
                                )}
                                style={{ height: "1.1rem", width: "1.1rem" }}
                              >
                                {done && <Check className="h-3 w-3" strokeWidth={3} />}
                              </span>
                              <span className={cn(done && "line-through opacity-70")}>{item}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: verified proof + publish */}
            <div className="space-y-6">
              <VerifiedEvidence
                solvedCount={readiness.stats.solved}
                easy={readiness.stats.easy}
                medium={readiness.stats.medium}
                hard={readiness.stats.hard}
                itemsDone={readiness.stats.itemsDone}
              />
              <PublishPanel
                profileQuery={profileQuery}
                updateProfileFn={updateProfileFn}
                onSaved={() => profileQuery.refetch()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({
  readiness,
  roleLabel,
  company,
}: {
  readiness: ReturnType<typeof computeReadiness>;
  roleLabel: string;
  company: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-card p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <Gauge value={readiness.score} />
        <div className="flex-1 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary-glow">
            {readiness.level}
          </span>
          <h2 className="mt-3 font-display text-xl font-bold sm:text-2xl">
            {readiness.score}% ready for {roleLabel}
            {company ? ` @ ${company}` : ""}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{readiness.levelBlurb}</p>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {readiness.pillars.map((p) => {
              const Icon = pillarIcons[p.key];
              return (
                <div key={p.key} className="rounded-lg border border-border/60 bg-background/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" /> {p.label}
                    </span>
                    <span className="font-display text-sm font-bold tabular-nums">{p.score}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-gradient-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${p.score}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{p.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const size = 148;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 18 });
  const dash = useTransform(spring, (v) => `${(v / 100) * circ} ${circ}`);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    mv.set(value);
    const controls = animate(display, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ strokeDasharray: dash }}
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.7 0.18 285)" />
            <stop offset="100%" stopColor="oklch(0.8 0.16 200)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold tabular-nums">{display}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function VerifiedEvidence({
  solvedCount,
  easy,
  medium,
  hard,
  itemsDone,
}: {
  solvedCount: number;
  easy: number;
  medium: number;
  hard: number;
  itemsDone: number;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-card p-5">
      <h3 className="flex items-center gap-2 font-display text-base font-semibold">
        <ShieldCheck className="h-5 w-5 text-success" /> Verified proof
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Every item here is server-recorded and tamper-proof — recruiters can trust it.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-success/30 bg-success/10 p-2.5">
          <p className="font-display text-lg font-bold text-success">{easy}</p>
          <p className="text-[11px] text-muted-foreground">Easy</p>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-2.5">
          <p className="font-display text-lg font-bold text-warning">{medium}</p>
          <p className="text-[11px] text-muted-foreground">Medium</p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5">
          <p className="font-display text-lg font-bold text-destructive">{hard}</p>
          <p className="text-[11px] text-muted-foreground">Hard</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">Problems solved</span>
        <span className="font-semibold tabular-nums">{solvedCount}</span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">Skills mastered</span>
        <span className="font-semibold tabular-nums">{itemsDone}</span>
      </div>
      {solvedCount === 0 && (
        <Link to="/playground">
          <Button className="mt-4 w-full bg-gradient-primary shadow-glow" size="sm">
            Solve your first problem <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function PublishPanel({
  profileQuery,
  updateProfileFn,
  onSaved,
}: {
  profileQuery: { data?: Awaited<ReturnType<typeof getMyProfile>> | null; refetch: () => void };
  updateProfileFn: (args: {
    data: { handle?: string | null; headline?: string | null; isPublic?: boolean; displayName?: string | null; location?: string | null };
  }) => Promise<{ ok: boolean; error?: string }>;
  onSaved: () => void;
}) {
  const data = profileQuery.data;
  const [handle, setHandle] = useState("");
  const [headline, setHeadline] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    setHandle(data.handle ?? "");
    setHeadline(data.headline ?? "");
    setIsPublic(data.isPublic);
  }, [data]);

  const proofUrl =
    typeof window !== "undefined" && handle ? `${window.location.origin}/p/${handle}` : "";

  const save = async (nextPublic?: boolean) => {
    setSaving(true);
    try {
      const res = await updateProfileFn({
        data: {
          handle: handle || null,
          headline: headline || null,
          isPublic: nextPublic ?? isPublic,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't save profile");
        return;
      }
      if (nextPublic !== undefined) setIsPublic(nextPublic);
      toast.success("Profile saved");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="publish" className="rounded-2xl border border-border/60 bg-gradient-card p-5">
      <h3 className="flex items-center gap-2 font-display text-base font-semibold">
        <Globe className="h-5 w-5 text-primary-glow" /> Shareable proof page
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        A public page recruiters can open to verify your readiness — every skill and solve backed by
        evidence.
      </p>

      <label className="mt-4 mb-1 block text-xs font-medium text-muted-foreground">Username</label>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">/p/</span>
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
          placeholder="yourname"
          className="bg-card/70"
        />
      </div>

      <label className="mt-3 mb-1 block text-xs font-medium text-muted-foreground">Headline</label>
      <Input
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
        placeholder="Aspiring Backend Engineer · Pakistan"
        className="bg-card/70"
      />

      <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Make profile public</p>
          <p className="text-[11px] text-muted-foreground">Anyone with the link can view it</p>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={(v) => {
            if (!handle) {
              toast.error("Pick a username first");
              return;
            }
            save(v);
          }}
          disabled={saving}
        />
      </div>

      <Button onClick={() => save()} disabled={saving} className="mt-3 w-full" variant="secondary" size="sm">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Save profile
      </Button>

      {isPublic && proofUrl && (
        <div className="mt-4 space-y-2 rounded-lg border border-success/30 bg-success/10 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Your proof page is live
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-background/60 px-2 py-1.5 text-xs">
              {proofUrl}
            </code>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(proofUrl);
                toast.success("Link copied");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <a href={proofUrl} target="_blank" rel="noreferrer">
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
