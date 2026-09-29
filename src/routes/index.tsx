import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Compass,
  Flame,
  Gauge,
  GitBranch,
  ListChecks,
  Map as MapIcon,
  Repeat,
  Send,
  Sparkles,
  TerminalSquare,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { OpportunityCard } from "@/components/OpportunityCard";
import { DailyChallengeCard } from "@/components/progress/DailyChallengeCard";
import { DIFF_TEXT } from "@/components/progress/Difficulty";
import { ProblemLink } from "@/components/progress/ProblemLink";
import { ProgressRing } from "@/components/progress/ProgressRing";
import { Button } from "@/components/ui/button";
import { OPPORTUNITIES, ROADMAPS } from "@/data/careerData";
import { DEFAULT_LIST_ID, listSlugs, STUDY_LISTS } from "@/data/lists";
import { useAuth } from "@/hooks/useAuth";
import { streakStats, useCollection } from "@/lib/local/store";
import { titleFromSlug, useCatalog } from "@/lib/progress/catalog";
import { useHydrated } from "@/lib/progress/hydrated";
import { activeList, dueReviews, relativeTime } from "@/lib/progress/stats";
import { SITE } from "@/config/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE.name} — Free coding interview practice` },
      { name: "description", content: SITE.description },
    ],
  }),
  component: Home,
});

function Home() {
  const activity = useCollection("activity");
  const solved = useCollection("solved");
  const returning = Object.keys(activity).length > 0 || Object.keys(solved).length > 0;

  return (
    <div className="pb-20">
      {returning ? <Dashboard /> : <Hero />}
      <CareerSections compact={returning} />
    </div>
  );
}

/* ================================================================= new users */

const FEATURES: { title: string; body: string; icon: LucideIcon; to: string }[] = [
  {
    title: "Problems",
    body: "The full LeetCode catalog with topic and company tags, each solvable in the browser.",
    icon: ListChecks,
    to: "/problems",
  },
  {
    title: "Study lists",
    body: "Blind 75, NeetCode 150, Grind 75, LeetCode 75 and Top Interview 150, with a pattern roadmap.",
    icon: GitBranch,
    to: "/lists",
  },
  {
    title: "Spaced review",
    body: "Solved problems come back for review on a schedule, so patterns stick past the interview.",
    icon: Repeat,
    to: "/progress",
  },
  {
    title: "AI coach",
    body: "Ask for hints without spoilers, or plan the rest of your prep and career.",
    icon: Sparkles,
    to: "/advisor",
  },
];

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-gradient-hero">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--foreground) 1px, transparent 1px), linear-gradient(to bottom, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(circle at 30% 20%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 30% 20%, black, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Free · No account needed
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.05] sm:text-5xl">
            Practice coding interviews with a real judge, in your browser.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            3,900+ problems, the study lists everyone recommends, an AI coach, career roadmaps and
            live opportunities. Your progress is saved locally from the first submission.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/lists/$listId" params={{ listId: "blind-75" }}>
                Start practicing <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/problems">Browse problems</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Starts with Blind 75. Prefer more coverage?{" "}
            <Link
              to="/lists/$listId"
              params={{ listId: "neetcode-150" }}
              className="text-foreground underline-offset-2 hover:underline"
            >
              NeetCode 150
            </Link>{" "}
            or{" "}
            <Link to="/lists" className="text-foreground underline-offset-2 hover:underline">
              compare lists
            </Link>
            .
          </p>
        </div>
        <div className="space-y-3">
          <DailyChallengeCard className="shadow-soft" />
          <div className="grid grid-cols-2 gap-3">
            {STUDY_LISTS.slice(0, 2).map((l) => (
              <Link
                key={l.id}
                to="/lists/$listId"
                params={{ listId: l.id }}
                className="rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-foreground/30"
              >
                <p className="font-display font-semibold">{l.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {listSlugs(l).length} problems · {l.sections.length}{" "}
                  {l.id === "neetcode-150" ? "patterns" : "topics"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl gap-px overflow-hidden border-t border-border/60 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <Link
            key={f.title}
            to={f.to}
            className="group bg-background/40 px-4 py-5 transition-colors hover:bg-card/60 sm:px-8 lg:px-6"
          >
            <f.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            <p className="mt-3 text-sm font-semibold">{f.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* =========================================================== returning users */

function Dashboard() {
  const { user } = useAuth();
  const solved = useCollection("solved");
  const submissions = useCollection("submissions");
  const activity = useCollection("activity");
  const review = useCollection("review");
  const { bySlug } = useCatalog();
  const hydrated = useHydrated();
  const now = hydrated ? Date.now() : 0;

  const streak = streakStats(activity);
  const due = hydrated ? dueReviews(review, now) : [];
  const active = activeList(solved, DEFAULT_LIST_ID);
  const last = submissions[0];
  const lastProblem = last ? bySlug.get(last.slug) : undefined;
  const lastSolved = last ? Boolean(solved[last.slug]) : false;

  const meta = user?.user_metadata ?? {};
  const name: string = meta.display_name || meta.full_name || meta.name || "";
  const firstName = name.split(" ")[0];

  const nextTitle = active.next
    ? (bySlug.get(active.next)?.title ?? titleFromSlug(active.next))
    : null;
  const nextDifficulty = active.next ? bySlug.get(active.next)?.difficulty : undefined;
  const nextSection = active.list.sections.find(
    (s) => active.next && s.slugs.includes(active.next),
  );

  return (
    <section className="border-b border-border/60 bg-gradient-hero">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {Object.keys(solved).length} solved
              {streak.today > 0
                ? ` · ${streak.today} submission${streak.today === 1 ? "" : "s"} today`
                : " · nothing submitted today yet"}
            </p>
          </div>
          <Link
            to="/progress"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Full progress <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Continue */}
          <section
            aria-labelledby="continue-heading"
            className="flex flex-col rounded-2xl border border-border/60 bg-card p-5"
          >
            <h2
              id="continue-heading"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Continue where you left off
            </h2>
            {last ? (
              <>
                <ProblemLink
                  slug={last.slug}
                  className="mt-3 font-display text-lg font-semibold leading-snug hover:underline"
                >
                  {lastProblem ? `${lastProblem.id}. ` : ""}
                  {last.title}
                </ProblemLink>
                <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {lastProblem && (
                    <span className={cn("font-medium", DIFF_TEXT[lastProblem.difficulty])}>
                      {lastProblem.difficulty}
                    </span>
                  )}
                  <span
                    className={last.status === "Accepted" ? "text-success" : "text-destructive"}
                  >
                    {last.status}
                  </span>
                  {hydrated && <span>{relativeTime(last.at, now)}</span>}
                </p>
                <div className="mt-auto pt-5">
                  <ProblemLink
                    slug={last.slug}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    {lastSolved ? "Open again" : "Keep going"} <ArrowRight className="h-4 w-4" />
                  </ProblemLink>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Your latest submission shows up here.{" "}
                <Link to="/problems" className="text-foreground hover:underline">
                  Pick a problem
                </Link>
                .
              </p>
            )}
          </section>

          <DailyChallengeCard />

          {/* Streak + reviews */}
          <div className="grid gap-4 md:col-span-2 md:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
            <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5">
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                  streak.today > 0
                    ? "bg-warning/15 text-warning"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Flame className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-2xl font-bold tabular-nums">
                  {streak.current}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">day streak</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Longest {streak.longest} · {streak.activeDays} active days
                </p>
              </div>
            </div>
            <Link
              to="/progress"
              hash="review"
              className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-foreground/30"
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                  due.length ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
                )}
              >
                <Repeat className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl font-bold tabular-nums">
                  {due.length}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    review{due.length === 1 ? "" : "s"} due
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {due.length
                    ? due
                        .slice(0, 2)
                        .map((r) => r.title)
                        .join(", ")
                    : "Nothing to review right now"}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* Active list */}
        <section
          aria-labelledby="active-list-heading"
          className="mt-4 flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-5 md:flex-row md:items-center"
        >
          <ProgressRing
            value={active.pct}
            size={64}
            stroke={5}
            color={active.done === active.total ? "var(--success)" : "var(--foreground)"}
            label={`${active.done} of ${active.total} solved`}
          >
            <span className="text-xs font-semibold tabular-nums">
              {Math.round(active.pct * 100)}%
            </span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active list
            </p>
            <h2 id="active-list-heading" className="mt-0.5 font-display text-lg font-semibold">
              <Link
                to="/lists/$listId"
                params={{ listId: active.list.id }}
                className="hover:underline"
              >
                {active.list.name}
              </Link>{" "}
              <span className="text-sm font-normal tabular-nums text-muted-foreground">
                {active.done}/{active.total}
              </span>
            </h2>
            <div className="mt-2 flex h-1.5 gap-0.5" aria-hidden>
              {active.sections.map((s) => (
                <span
                  key={s.title}
                  className="relative flex-1 overflow-hidden rounded-full bg-muted"
                  style={{ flexGrow: s.total }}
                  title={`${s.title}: ${s.done}/${s.total}`}
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      s.done === s.total ? "bg-success" : "bg-foreground/60",
                    )}
                    style={{ width: `${(s.done / s.total) * 100}%` }}
                  />
                </span>
              ))}
            </div>
          </div>
          {active.next && nextTitle ? (
            <ProblemLink
              slug={active.next}
              list={active.list.id}
              className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/60 px-4 py-3 transition-colors hover:border-foreground/30 md:w-80"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">
                  Next{nextSection ? ` in ${nextSection.title}` : ""}
                </p>
                <p className="truncate text-sm font-medium">{nextTitle}</p>
                {nextDifficulty && (
                  <p className={cn("text-[11px] font-medium", DIFF_TEXT[nextDifficulty])}>
                    {nextDifficulty}
                  </p>
                )}
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </ProblemLink>
          ) : (
            <Link to="/lists" className="text-sm font-medium hover:underline">
              List complete. Pick another
            </Link>
          )}
        </section>

        {/* Quick links */}
        <nav
          aria-label="Quick links"
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
        >
          {(
            [
              ["Problems", "/problems", ListChecks],
              ["Study lists", "/lists", GitBranch],
              ["Leaderboard", "/leaderboard", Trophy],
              ["Compiler", "/compiler", TerminalSquare],
              ["Readiness", "/readiness", Gauge],
              ["AI Advisor", "/advisor", Sparkles],
            ] as const
          ).map(([label, to, Icon]) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 text-sm transition-colors hover:border-foreground/30"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}

/* ============================================================ career sections */

function CareerSections({ compact }: { compact: boolean }) {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const ask = (q = prompt.trim()) => navigate({ to: "/advisor", search: q ? { q } : {} });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
      {/* Advisor */}
      <section
        aria-labelledby="advisor-heading"
        className="mt-12 rounded-2xl border border-border/60 bg-card p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2
              id="advisor-heading"
              className="flex items-center gap-2 font-display text-lg font-semibold"
            >
              <Sparkles className="h-4 w-4 text-muted-foreground" /> Ask the AI advisor
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Interview plans, study schedules, roadmaps and programs worth applying to.
            </p>
          </div>
          <form
            className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-background/60 p-1.5 focus-within:border-foreground/40 lg:max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="How should I prepare for a Google interview in 6 weeks?"
              aria-label="Ask the AI advisor"
              className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="sm" className="shrink-0 gap-1.5">
              <Send className="h-3.5 w-3.5" /> Ask
            </Button>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {[
            "Plan my NeetCode 150 in 8 weeks",
            "How do I get into GSoC?",
            "Backend roadmap for a student",
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => ask(chip)}
              className="rounded-full border border-border/60 px-3 py-1 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      {/* Roadmaps */}
      <SectionHeading
        title="Career roadmaps"
        subtitle="A clear sequence of skills for each role."
        to="/roadmaps"
        cta="All roadmaps"
        icon={MapIcon}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROADMAPS.slice(0, compact ? 3 : 6).map((r) => (
          <Link
            key={r.id}
            to="/roadmaps"
            className="group flex h-full items-start gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-foreground/30"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-medium">{r.role}</h3>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.summary}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {r.duration} · {r.stages.length} stages
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Opportunities */}
      <SectionHeading
        title="Opportunities"
        subtitle="Programs, contests and internships, with application windows kept current."
        to="/opportunities"
        cta="View all"
        icon={Compass}
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OPPORTUNITIES.slice(0, 3).map((opp) => (
          <OpportunityCard key={opp.id} opp={opp} />
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <Link to="/resources" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <BookOpen className="h-4 w-4" /> Free resources
        </Link>
        <Link to="/readiness" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <Gauge className="h-4 w-4" /> Readiness score
        </Link>
        <Link to="/compiler" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <TerminalSquare className="h-4 w-4" /> Online compiler
        </Link>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  to,
  cta,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  to: "/roadmaps" | "/opportunities";
  cta: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mt-12 flex items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Icon className="h-4 w-4 text-muted-foreground" /> {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Link
        to={to}
        className="hidden shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:flex"
      >
        {cta} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
