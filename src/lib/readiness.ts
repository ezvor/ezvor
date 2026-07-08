// Readiness Engine — the honest core of Ezvor.
//
// Given a user's REAL, server-verified activity (problems judged accepted in
// the DSA Arena + roadmap skills they've marked mastered) and a target role,
// this computes a calibrated readiness score, a pillar breakdown, and the
// highest-impact next moves. Pure and deterministic — no network, no AI — so
// it always works and always returns the same score for the same evidence.

import type { Roadmap } from "@/data/careerData";

export interface SolvedRow {
  difficulty: string;
  solved_at: string;
}

export interface ProgressRow {
  item: string;
  completed_at: string;
}

export interface ReadinessPillar {
  key: "foundations" | "dsa" | "consistency" | "proof";
  label: string;
  score: number; // 0-100
  weight: number; // 0-1
  detail: string;
}

export interface ReadinessMove {
  title: string;
  detail: string;
  impact: number; // estimated points added to overall score
  ctaLabel: string;
  ctaTo: "/playground" | "/readiness" | "/opportunities" | "/roadmaps";
}

export interface ReadinessStats {
  solved: number;
  easy: number;
  medium: number;
  hard: number;
  itemsDone: number;
  itemsTotal: number;
  active30: number; // distinct active days in last 30
  dsaPoints: number;
  dsaTargetPoints: number;
}

export interface ReadinessResult {
  score: number;
  level: string;
  levelBlurb: string;
  pillars: ReadinessPillar[];
  moves: ReadinessMove[];
  stats: ReadinessStats;
}

// How much competitive DSA depth a role realistically demands. Drives how
// heavily solved problems weigh into readiness for that target.
const DSA_TARGET_POINTS: Record<string, number> = {
  "software-engineer": 280,
  "competitive-programmer": 420,
  backend: 300,
  fullstack: 280,
  "ml-engineer": 260,
  "ai-engineer": 240,
  "data-scientist": 200,
  "data-engineer": 200,
  "game-dev": 200,
  blockchain: 220,
  frontend: 160,
  mobile: 180,
  devops: 130,
  "cloud-architect": 140,
  dba: 130,
  "network-engineer": 110,
  "data-analyst": 120,
  "data-architect": 150,
  cybersecurity: 150,
  sqa: 110,
  uiux: 60,
  "business-analyst": 70,
  "open-source": 180,
};

const DEFAULT_DSA_TARGET = 200;

// Weight of each pillar in the final score. Foundations (role skills) and DSA
// carry the most; consistency and shareable proof round it out.
const WEIGHTS = { foundations: 0.38, dsa: 0.3, consistency: 0.14, proof: 0.18 };

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function levelFor(score: number): { level: string; blurb: string } {
  if (score >= 90)
    return { level: "Elite", blurb: "You're in the top tier for this target. Start applying and interviewing now." };
  if (score >= 75)
    return { level: "Interview-ready", blurb: "Strong signal. Polish weak spots and go after real openings." };
  if (score >= 50)
    return { level: "Competitive", blurb: "Solid base. Close the gaps below to become interview-ready." };
  if (score >= 25)
    return { level: "Building", blurb: "Good momentum. Keep stacking verified proof consistently." };
  return { level: "Exploring", blurb: "Early days. Pick your target and start earning verified evidence." };
}

function distinctActiveDays(dates: string[], windowDays: number): number {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const days = new Set<string>();
  for (const d of dates) {
    const t = new Date(d).getTime();
    if (!Number.isNaN(t) && t >= cutoff) days.add(new Date(d).toISOString().slice(0, 10));
  }
  return days.size;
}

export function computeReadiness(
  roadmap: Roadmap | undefined,
  solved: SolvedRow[],
  completedItems: Set<string>,
): ReadinessResult {
  // ---- DSA strength ----
  let easy = 0,
    medium = 0,
    hard = 0;
  for (const s of solved) {
    const d = (s.difficulty || "").toLowerCase();
    if (d.startsWith("e")) easy++;
    else if (d.startsWith("h")) hard++;
    else medium++;
  }
  const dsaPoints = easy * 1 + medium * 3 + hard * 6;
  const dsaTargetPoints = roadmap ? (DSA_TARGET_POINTS[roadmap.id] ?? DEFAULT_DSA_TARGET) : DEFAULT_DSA_TARGET;
  const dsaScore = clamp((dsaPoints / dsaTargetPoints) * 100);

  // ---- Foundations coverage (target roadmap skills mastered) ----
  const allItems = roadmap ? roadmap.stages.flatMap((st) => st.items) : [];
  const itemsTotal = allItems.length;
  const itemsDone = allItems.filter((i) => completedItems.has(i)).length;
  const foundationsScore = itemsTotal ? clamp((itemsDone / itemsTotal) * 100) : 0;

  // ---- Consistency (recent, sustained activity) ----
  const allDates = [...solved.map((s) => s.solved_at)];
  const active30 = distinctActiveDays(allDates, 30);
  // 12+ active days in 30 = full marks.
  const consistencyScore = clamp((active30 / 12) * 100);

  // ---- Proof depth (verified, shareable evidence) ----
  const evidence = solved.length + itemsDone;
  // 45+ pieces of verified evidence = full marks.
  const proofScore = clamp((evidence / 45) * 100);

  const pillars: ReadinessPillar[] = [
    {
      key: "foundations",
      label: "Role skills",
      score: foundationsScore,
      weight: WEIGHTS.foundations,
      detail: itemsTotal
        ? `${itemsDone}/${itemsTotal} target skills mastered`
        : "Choose a target role to track skills",
    },
    {
      key: "dsa",
      label: "DSA strength",
      score: dsaScore,
      weight: WEIGHTS.dsa,
      detail: `${solved.length} solved · ${dsaPoints}/${dsaTargetPoints} depth pts`,
    },
    {
      key: "consistency",
      label: "Consistency",
      score: consistencyScore,
      weight: WEIGHTS.consistency,
      detail: `${active30} active day${active30 === 1 ? "" : "s"} in last 30`,
    },
    {
      key: "proof",
      label: "Verified proof",
      score: proofScore,
      weight: WEIGHTS.proof,
      detail: `${evidence} verified evidence item${evidence === 1 ? "" : "s"}`,
    },
  ];

  const score = clamp(pillars.reduce((sum, p) => sum + p.score * p.weight, 0));
  const { level, blurb } = levelFor(score);

  // ---- Highest-impact next moves (ranked by estimated score delta) ----
  const moves: ReadinessMove[] = [];

  // Foundations: complete the next incomplete stage's items.
  if (roadmap && foundationsScore < 100) {
    const nextStage = roadmap.stages.find((st) => st.items.some((i) => !completedItems.has(i)));
    if (nextStage) {
      const remaining = nextStage.items.filter((i) => !completedItems.has(i));
      const chunk = remaining.slice(0, 3);
      const impact = clamp((chunk.length / itemsTotal) * 100 * WEIGHTS.foundations);
      moves.push({
        title: `Master ${chunk.length} skill${chunk.length === 1 ? "" : "s"} in "${nextStage.title}"`,
        detail: chunk.join(" · "),
        impact,
        ctaLabel: "Open roadmap",
        ctaTo: "/readiness",
      });
    }
  }

  // DSA: solve more mediums to close the depth gap.
  if (dsaScore < 100) {
    const gap = dsaTargetPoints - dsaPoints;
    const mediumsNeeded = Math.max(3, Math.min(10, Math.ceil(gap / 3 / 3))); // ~a week's worth
    const addedPoints = mediumsNeeded * 3;
    const impact = clamp((addedPoints / dsaTargetPoints) * 100 * WEIGHTS.dsa);
    moves.push({
      title: `Solve ${mediumsNeeded} more medium problems`,
      detail: "Each accepted submission is judged and added to your verified proof.",
      impact,
      ctaLabel: "Open EzCode",
      ctaTo: "/playground",
    });
  }

  // Consistency: build a streak.
  if (consistencyScore < 100) {
    const impact = clamp((Math.min(4, 12 - active30) / 12) * 100 * WEIGHTS.consistency);
    moves.push({
      title: "Solve at least one problem on 4 days this week",
      detail: "Recruiters trust steady, recent activity more than a one-time grind.",
      impact,
      ctaLabel: "Start a streak",
      ctaTo: "/playground",
    });
  }

  // Proof: make it shareable.
  if (proofScore < 60) {
    moves.push({
      title: "Publish your verified proof profile",
      detail: "Turn on your public page so recruiters can verify every skill and solve.",
      impact: 6,
      ctaLabel: "Publish profile",
      ctaTo: "/readiness",
    });
  }

  moves.sort((a, b) => b.impact - a.impact);

  return {
    score,
    level,
    levelBlurb: blurb,
    pillars,
    moves: moves.slice(0, 3),
    stats: {
      solved: solved.length,
      easy,
      medium,
      hard,
      itemsDone,
      itemsTotal,
      active30,
      dsaPoints,
      dsaTargetPoints,
    },
  };
}
