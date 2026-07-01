import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  animate,
  useReducedMotion,
} from "motion/react";
import {
  Compass,
  Map as MapIcon,
  BookOpen,
  ArrowRight,
  ArrowUpRight,
  Send,
  Terminal,
  GitBranch,
  Layers,
  Cpu,
  Command,
} from "lucide-react";

import { OpportunityCard } from "@/components/OpportunityCard";
import { Button } from "@/components/ui/button";
import { OPPORTUNITIES, ROADMAPS, RESOURCES, CATEGORIES } from "@/data/careerData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PathPilot — Career Platform for Engineers" },
      {
        name: "description",
        content:
          "A free platform for developers: curated opportunities like GSoC, LFX, ICPC and Meta Hacker Cup, structured role roadmaps, hand-picked resources, and a DSA arena.",
      },
    ],
  }),
  component: Dashboard,
});

const stats = [
  { label: "Opportunities tracked", value: OPPORTUNITIES.length, suffix: "+", icon: Compass },
  { label: "Role roadmaps", value: ROADMAPS.length, suffix: "", icon: MapIcon },
  { label: "Free resources", value: RESOURCES.length, suffix: "+", icon: BookOpen },
  { label: "Domains covered", value: CATEGORIES.length, suffix: "", icon: Layers },
];

const ease = [0.22, 1, 0.36, 1] as const;

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const reduce = useReducedMotion();

  // Pointer-reactive glow in the hero.
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(30);
  const sx = useSpring(glowX, { stiffness: 60, damping: 20 });
  const sy = useSpring(glowY, { stiffness: 60, damping: 20 });

  const ask = () => {
    const q = prompt.trim();
    navigate({ to: "/advisor", search: q ? { q } : undefined });
  };

  const featured = OPPORTUNITIES.slice(0, 6);
  const roadmapPreview = ROADMAPS.slice(0, 6);

  const onHeroMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    glowX.set(((e.clientX - r.left) / r.width) * 100);
    glowY.set(((e.clientY - r.top) / r.height) * 100);
  };

  return (
    <div className="pb-20">
      {/* ───────────────── Hero ───────────────── */}
      <section
        onMouseMove={onHeroMove}
        className="relative overflow-hidden border-b border-border/60"
      >
        {/* layered background */}
        <div className="absolute inset-0 bg-gradient-hero" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.7 0.1 280 / 40%) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.7 0.1 280 / 40%) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(circle at 30% 20%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(circle at 30% 20%, black, transparent 75%)",
          }}
        />
        <motion.div
          className="pointer-events-none absolute -z-0 h-[36rem] w-[36rem] rounded-full blur-[120px]"
          style={{
            left: sx.get() ? undefined : "20%",
            background:
              "radial-gradient(circle, oklch(0.6 0.2 285 / 45%), transparent 70%)",
            top: "-8rem",
            x: useSpringToPx(sx),
          }}
        />

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* Left: copy + search */}
          <div>
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary-glow"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Free forever · Built for developers
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.05 }}
              className="mt-5 max-w-2xl text-4xl font-bold leading-[1.05] sm:text-5xl"
            >
              Ship a serious engineering career,{" "}
              <span className="text-gradient">from first commit to offer letter</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.12 }}
              className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground"
            >
              Real opportunities like GSoC, LFX, ICPC and Meta Hacker Cup, structured
              roadmaps for every domain, a built-in DSA arena, and only the resources
              worth your time. No paywalls, no fluff.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.2 }}
              className="mt-7 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-soft backdrop-blur transition-colors focus-within:border-primary/50"
            >
              <span className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary-glow">
                <Terminal className="h-4 w-4" />
              </span>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
                placeholder="How do I get selected for GSoC?"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button onClick={ask} className="shrink-0 bg-gradient-primary shadow-glow">
                <Send className="h-4 w-4" /> Ask
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="opacity-70">Popular:</span>
              {["System design in 8 weeks", "Break into open source", "SDE interview prep"].map(
                (chip) => (
                  <button
                    key={chip}
                    onClick={() => navigate({ to: "/advisor", search: { q: chip } })}
                    className="rounded-full border border-border/60 bg-card/50 px-3 py-1 transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {chip}
                  </button>
                ),
              )}
            </motion.div>
          </div>

          {/* Right: terminal card */}
          <motion.div
            initial={{ opacity: 0, y: 28, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.15 }}
            className="hidden lg:block"
          >
            <TerminalCard />
          </motion.div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* ───────────────── Stats ───────────────── */}
        <div className="-mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, ease, delay: i * 0.06 }}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-card p-4 shadow-soft"
            >
              <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
              <s.icon className="h-5 w-5 text-primary-glow" />
              <p className="mt-3 font-display text-3xl font-bold tabular-nums">
                <AnimatedNumber value={s.value} suffix={s.suffix} />
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ───────────────── Primary actions ───────────────── */}
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            {
              to: "/opportunities" as const,
              title: "Explore opportunities",
              desc: "GSoC, LFX, ICPC, hackathons, internships and scholarships, with live status.",
              icon: Compass,
            },
            {
              to: "/roadmaps" as const,
              title: "Follow a roadmap",
              desc: "Battle-tested paths for frontend, backend, data, DevOps and more.",
              icon: MapIcon,
            },
            {
              to: "/playground" as const,
              title: "Train in the DSA arena",
              desc: "Solve, compile and benchmark like the top competitive judges.",
              icon: Cpu,
            },
          ].map((c, i) => (
            <motion.div
              key={c.to}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, ease, delay: i * 0.08 }}
            >
              <Link
                to={c.to}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-elegant"
              >
                <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary-glow transition-transform duration-300 group-hover:scale-110">
                  <c.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 flex items-center gap-1 font-display text-lg font-semibold">
                  {c.title}
                  <ArrowRight className="h-4 w-4 opacity-0 -translate-x-1 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* ───────────────── Roadmaps rail ───────────────── */}
        <SectionHeading
          title="Roadmaps for every path"
          subtitle="Pick a role and get a clear sequence, not a wall of links."
          to="/roadmaps"
          cta="All roadmaps"
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roadmapPreview.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.45, ease, delay: i * 0.05 }}
            >
              <Link
                to="/roadmaps"
                className="group flex h-full items-start gap-3 rounded-xl border border-border/60 bg-gradient-card p-4 transition-all hover:-translate-y-1 hover:border-primary/50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary-glow">
                  <GitBranch className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate font-medium">{r.role}</h4>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary-glow" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.summary}</p>
                  <span className="mt-2 inline-block rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {r.duration} · {r.stages.length} stages
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* ───────────────── Featured opportunities ───────────────── */}
        <SectionHeading
          title="Opportunities worth applying to"
          subtitle="High-signal programs, with application windows kept up to date."
          to="/opportunities"
          cta="View all"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((opp, i) => (
            <motion.div
              key={opp.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, ease, delay: (i % 3) * 0.08 }}
            >
              <OpportunityCard opp={opp} />
            </motion.div>
          ))}
        </div>

        {/* ───────────────── Closing CTA ───────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease }}
          className="relative mt-16 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-card p-8 sm:p-12"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold sm:text-3xl">
                Stop guessing your next move.
              </h3>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Tell it your current skills and target role. Get a personalized plan with the
                exact opportunities and resources that fit.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => navigate({ to: "/advisor" })}
              className="shrink-0 bg-gradient-primary shadow-glow"
            >
              <Command className="h-4 w-4" /> Start planning
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  to,
  cta,
}: {
  title: string;
  subtitle: string;
  to: "/roadmaps" | "/opportunities";
  cta: string;
}) {
  return (
    <div className="mt-16 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Link
        to={to}
        className="hidden shrink-0 items-center gap-1 text-sm text-primary-glow transition-transform hover:translate-x-0.5 sm:flex"
      >
        {cta} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

const terminalLines = [
  { p: "$", c: "pathpilot init --role backend", muted: false },
  { p: ">", c: "scanning opportunities…", muted: true },
  { p: "✓", c: "3 open programs match your profile", muted: false },
  { p: ">", c: "building roadmap: 4 stages, 5 months", muted: true },
  { p: "✓", c: "ready. run `pathpilot start`", muted: false },
];

function TerminalCard() {
  const [shown, setShown] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      setShown(terminalLines.length);
      return;
    }
    if (shown >= terminalLines.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 520);
    return () => clearTimeout(t);
  }, [shown, reduce]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 shadow-elegant backdrop-blur">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-destructive/70" />
        <span className="h-3 w-3 rounded-full bg-warning/70" />
        <span className="h-3 w-3 rounded-full bg-success/70" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">pathpilot — zsh</span>
      </div>
      <div className="space-y-2 p-5 font-mono text-sm">
        {terminalLines.slice(0, shown).map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-2"
          >
            <span
              className={
                l.p === "✓"
                  ? "text-success"
                  : l.p === "$"
                    ? "text-primary-glow"
                    : "text-muted-foreground"
              }
            >
              {l.p}
            </span>
            <span className={l.muted ? "text-muted-foreground" : "text-foreground"}>{l.c}</span>
          </motion.div>
        ))}
        {shown >= terminalLines.length && (
          <span className="inline-block h-4 w-2 animate-pulse bg-primary-glow align-middle" />
        )}
      </div>
    </div>
  );
}

// Small helper so the hero glow can subtly follow the pointer without re-rendering.
function useSpringToPx(mv: ReturnType<typeof useSpring>) {
  return mv;
}
