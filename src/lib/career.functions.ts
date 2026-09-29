// AI career helpers: list roadmaps, opportunity discovery and personalised
// skill graphs. Each one validates the model output and degrades gracefully
// (curated data) when every AI provider is busy.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GraphRoadmap, GraphNode, GraphEdge, NodeResource } from "@/data/graphData";
import type { ChatMessage } from "./ai.server";

/* --------------------------------------------------------------- helpers */

const AI_BUSY = "Our free AI providers are busy right now. Please try again in a minute.";

function str(v: unknown, max = 300): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function strList(v: unknown, maxItems: number, maxLen = 160): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = str(x, maxLen);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9+#]+/g, " ")
      .split(" ")
      .filter(
        (w) =>
          w.length > 1 && !["and", "the", "for", "engineer", "developer", "to", "of"].includes(w),
      ),
  );
}

/** Pick the item whose label best overlaps the query (0 when nothing overlaps). */
function bestMatch<T>(
  items: T[],
  label: (t: T) => string,
  query: string,
): { item: T; score: number } | null {
  const q = words(query);
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const w = words(label(item));
    let score = 0;
    for (const t of q) if (w.has(t)) score++;
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best;
}

function safeUrl(u: unknown): string | null {
  const s = str(u, 500);
  try {
    const url = new URL(s);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function limiter(userId: string | null) {
  const { enforceRateLimit } = await import("./rate-limit.server");
  enforceRateLimit("generate", { userId });
}

async function structured<T>(
  messages: ChatMessage[],
  schema: { name: string; description: string; parameters: Record<string, unknown> },
  tier: "fast" | "smart" = "smart",
): Promise<T | null> {
  const { aiJSON } = await import("./ai.server");
  try {
    return await aiJSON<T>(messages, schema, { tier });
  } catch (e) {
    console.warn(`[career] ${schema.name} failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/* ----------------------------------------------------------- list roadmap */

export interface ListRoadmap {
  role: string;
  summary: string;
  duration: string;
  stages: { title: string; items: string[] }[];
  /** Set when AI was unavailable and a curated roadmap was returned instead. */
  fallback?: string;
}

/** Generate a personalized learning roadmap for any role or goal. */
export const generateRoadmap = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(z.object({ goal: z.string().trim().min(2).max(120) }))
  .handler(async ({ data, context }): Promise<ListRoadmap> => {
    await limiter(context.userId as string | null);

    const raw = await structured<{
      role?: string;
      summary?: string;
      duration?: string;
      stages?: unknown;
    }>(
      [
        {
          role: "system",
          content:
            "You are a career mentor. Build a realistic, modern learning roadmap with 4-5 progressive stages. Each stage has 3-5 concrete, specific items. Be accurate and practical.",
        },
        { role: "user", content: `Create a step-by-step roadmap to become a ${data.goal}.` },
      ],
      {
        name: "build_roadmap",
        description: "Return a structured learning roadmap.",
        parameters: {
          type: "object",
          properties: {
            role: { type: "string" },
            summary: { type: "string", description: "One-sentence summary" },
            duration: { type: "string", description: "Estimated time, e.g. '6-9 months'" },
            stages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  items: { type: "array", items: { type: "string" } },
                },
                required: ["title", "items"],
              },
            },
          },
          required: ["role", "summary", "duration", "stages"],
        },
      },
    );

    const stages = Array.isArray(raw?.stages)
      ? (raw.stages as { title?: unknown; items?: unknown }[])
          .map((s) => ({ title: str(s?.title, 80), items: strList(s?.items, 7) }))
          .filter((s) => s.title && s.items.length)
          .slice(0, 7)
      : [];
    if (raw && stages.length >= 2) {
      return {
        role: str(raw.role, 80) || data.goal,
        summary: str(raw.summary, 300),
        duration: str(raw.duration, 40) || "Varies",
        stages,
      };
    }

    // AI unavailable or malformed: serve the closest curated roadmap.
    const { ROADMAPS } = await import("@/data/careerData");
    const match = bestMatch(ROADMAPS, (r) => `${r.role} ${r.id}`, data.goal)?.item;
    if (!match) throw new Error(AI_BUSY);
    return {
      role: match.role,
      summary: match.summary,
      duration: match.duration,
      stages: match.stages,
      fallback: `AI is busy, so here's our curated ${match.role} roadmap.`,
    };
  });

/* ------------------------------------------------------ discover programs */

export interface DiscoveredOpportunity {
  title: string;
  org: string;
  category: string;
  blurb: string;
  timing: string;
  eligibility: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  url?: string;
}

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;

/** Discover opportunities tailored to a field or interest (grounded on a web search). */
export const discoverOpportunities = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(z.object({ query: z.string().trim().min(2).max(160) }))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ opportunities: DiscoveredOpportunity[]; fallback?: string }> => {
      await limiter(context.userId as string | null);
      const { webSearch } = await import("./web.server");

      const hits = await webSearch(
        `${data.query} program apply scholarship OR internship OR fellowship`,
        {
          limit: 8,
        },
      ).catch(() => []);
      const sources = hits
        .map((h, i) => `[${i}] ${h.title}\n${h.url}\n${(h.description || "").slice(0, 240)}`)
        .join("\n\n");

      const raw = await structured<{ opportunities?: Record<string, unknown>[] }>(
        [
          {
            role: "system",
            content:
              "You are a career-opportunities curator. List real, well-known programs (scholarships, internships, open-source mentorships, hackathons, contests, fellowships) relevant to the user's interest. Only include programs you are confident exist. Describe typical timing rather than exact dates. When a program matches one of the numbered web sources, set `source` to its index; otherwise use -1. Never invent links.",
          },
          {
            role: "user",
            content: `Find 6 relevant opportunities for someone interested in: ${data.query}.\n\nWeb sources:\n${sources || "(none)"}`,
          },
        ],
        {
          name: "list_opportunities",
          description: "Return a list of relevant opportunities.",
          parameters: {
            type: "object",
            properties: {
              opportunities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    org: { type: "string" },
                    category: { type: "string" },
                    blurb: { type: "string" },
                    timing: { type: "string" },
                    eligibility: { type: "string" },
                    difficulty: { type: "string", enum: [...DIFFICULTIES] },
                    source: {
                      type: "integer",
                      description: "Index of the matching web source, or -1",
                    },
                  },
                  required: [
                    "title",
                    "org",
                    "category",
                    "blurb",
                    "timing",
                    "eligibility",
                    "difficulty",
                  ],
                },
              },
            },
            required: ["opportunities"],
          },
        },
        "fast",
      );

      const list: DiscoveredOpportunity[] = [];
      for (const o of raw?.opportunities ?? []) {
        const title = str(o.title, 120);
        const org = str(o.org, 80);
        if (!title || !org || list.some((x) => x.title === title)) continue;
        const idx = typeof o.source === "number" ? o.source : -1;
        const url = hits[idx] ? safeUrl(hits[idx].url) : null;
        list.push({
          title,
          org,
          category: str(o.category, 40) || "Program",
          blurb: str(o.blurb, 320),
          timing: str(o.timing, 120) || "Varies — check the official site",
          eligibility: str(o.eligibility, 160) || "See official site",
          difficulty: DIFFICULTIES.find((d) => d === o.difficulty) ?? "Intermediate",
          ...(url ? { url } : {}),
        });
        if (list.length >= 8) break;
      }
      if (list.length) return { opportunities: list };

      // Fallback: curated programs matching the query.
      const { OPPORTUNITIES } = await import("@/data/careerData");
      const q = words(data.query);
      const curated = OPPORTUNITIES.map((o) => {
        const w = words(
          `${o.title} ${o.org} ${o.category} ${o.field} ${o.tags.join(" ")} ${o.blurb}`,
        );
        let s = 0;
        for (const t of q) if (w.has(t)) s++;
        return { o, s };
      })
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 6)
        .map(({ o }) => ({
          title: o.title,
          org: o.org,
          category: o.category,
          blurb: o.blurb,
          timing: o.timing,
          eligibility: o.eligibility,
          difficulty: o.difficulty,
          url: o.url,
        }));
      if (!curated.length) throw new Error(AI_BUSY);
      return {
        opportunities: curated,
        fallback: "AI is busy, so these are matching programs from our curated list.",
      };
    },
  );

/* --------------------------------------------------------- personal graph */

type RawNode = {
  label?: unknown;
  desc?: unknown;
  category?: unknown;
  bridgeNote?: unknown;
  resources?: unknown;
};

const KINDS = ["Video", "Playlist", "Practice", "Docs", "Course"] as const;

function cleanResources(v: unknown): NodeResource[] {
  if (!Array.isArray(v)) return [];
  const out: NodeResource[] = [];
  for (const r of v as Record<string, unknown>[]) {
    const url = safeUrl(r?.url);
    const label = str(r?.label, 100);
    if (!url || !label) continue;
    out.push({
      label,
      provider: str(r?.provider, 60) || new URL(url).hostname.replace(/^www\./, ""),
      url,
      kind: KINDS.find((k) => k === r?.kind) ?? "Docs",
    });
    if (out.length >= 3) break;
  }
  return out;
}

/** Generate a personalized, NeetCode-style skill graph from current skills + target role. */
export const generatePersonalGraph = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(
    z.object({
      role: z.string().trim().min(2).max(80),
      skills: z.string().max(400).optional(),
    }),
  )
  .handler(async ({ data, context }): Promise<GraphRoadmap> => {
    await limiter(context.userId as string | null);
    const currentSkills = data.skills?.trim();
    const hasCurrent = !!currentSkills;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: [
          "You are a senior career-transition mentor. Your job is NOT to dump a generic roadmap for the target role.",
          "You build a MIGRATION MAP that shows how someone moves FROM their current background TO the target role.",
          "",
          "Rules for every node, classify it with `category`:",
          '- "transfer": a skill the learner ALREADY HAS that carries over directly. Do NOT teach it again; briefly say how it applies in the new role. Keep these to the first stage(s).',
          '- "bridge": something the learner partially knows but must REFRAME or EXTEND. Explain the delta from what they do today.',
          '- "new": a net-new skill they must learn from scratch. Go deeper here since this is where the real gap is.',
          "For EVERY node also fill `bridgeNote`: one concrete sentence relating it to the learner's stated background.",
          "",
          "Order stages so early stages leverage transferable strengths, middle stages bridge, and later stages build the missing core of the target role, ending job-ready. 4-6 stages, 1-2 nodes each, and give each stage a short `title`.",
          "Be specific to the ACTUAL transition named. Every node MUST include 1-3 FREE resources, preferring well-known YouTube channels/playlists (freeCodeCamp, NeetCode, TechWorld with Nana, KodeKloud, StatQuest, Corey Schafer) or official docs. Use real, working URLs.",
          "Set `title` to the transition itself, e.g. 'SQA Engineer -> DevOps'. Set `tagline` to one sentence naming the biggest gap to close.",
        ].join("\n"),
      },
      {
        role: "user",
        content: hasCurrent
          ? `Build the transition map.\nCurrent role / skills: ${currentSkills}\nTarget role: ${data.role}\nShow exactly what transfers, what must be reframed, and what is net-new to migrate from where I am today to ${data.role}.`
          : `Target role: ${data.role}\nCurrent skills: not specified. Assume an early-career learner and build a foundations-to-job-ready path; mark truly foundational items as "new".`,
      },
    ];

    const parsed = await structured<{ title?: unknown; tagline?: unknown; stages?: unknown }>(
      messages,
      {
        name: "build_graph",
        description: "Return a staged transition/skill graph with free resources per node.",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The transition, e.g. 'SQA Engineer -> DevOps'.",
            },
            tagline: {
              type: "string",
              description: "One sentence naming the biggest gap to close.",
            },
            stages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Short stage name." },
                  nodes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        desc: { type: "string" },
                        category: { type: "string", enum: ["transfer", "bridge", "new"] },
                        bridgeNote: { type: "string" },
                        resources: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              label: { type: "string" },
                              provider: { type: "string" },
                              url: { type: "string" },
                              kind: { type: "string", enum: [...KINDS] },
                            },
                            required: ["label", "provider", "url", "kind"],
                          },
                        },
                      },
                      required: ["label", "desc", "category", "bridgeNote", "resources"],
                    },
                  },
                },
                required: ["title", "nodes"],
              },
            },
          },
          required: ["title", "tagline", "stages"],
        },
      },
    );

    const stages = Array.isArray(parsed?.stages)
      ? (parsed.stages as { title?: unknown; nodes?: unknown }[])
          .map((s) => ({
            title: str(s?.title, 60),
            nodes: (Array.isArray(s?.nodes) ? (s.nodes as RawNode[]) : [])
              .map((n) => ({
                label: str(n?.label, 60),
                desc: str(n?.desc, 300),
                category: (["transfer", "bridge", "new"] as const).find((c) => c === n?.category),
                bridgeNote: str(n?.bridgeNote, 240) || undefined,
                resources: cleanResources(n?.resources),
              }))
              .filter((n) => n.label)
              .slice(0, 3),
          }))
          .filter((s) => s.nodes.length)
          .slice(0, 7)
      : [];

    if (!parsed || stages.length < 2) {
      // AI unavailable: offer the closest hand-built graph instead of failing.
      const { GRAPH_ROADMAPS } = await import("@/data/graphData");
      const match = bestMatch(
        GRAPH_ROADMAPS,
        (g) => `${g.title} ${g.id} ${g.tagline}`,
        data.role,
      )?.item;
      if (!match) throw new Error(AI_BUSY);
      return {
        ...match,
        id: "personal",
        title: `${match.title} (curated)`,
        tagline: `AI is busy, so here's our closest hand-built path. ${match.tagline}`,
      };
    }

    // Lay out stages into rows; nodes spread across columns.
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const idsByRow: string[][] = [];

    stages.forEach((stage, row) => {
      const rowIds: string[] = [];
      const count = Math.max(stage.nodes.length, 1);
      stage.nodes.forEach((n, i) => {
        const id = `s${row}n${i}`;
        const col = count === 1 ? 0.5 : 0.25 + (i * 0.5) / (count - 1);
        nodes.push({
          id,
          label: n.label,
          desc: n.desc,
          row,
          col,
          resources: n.resources,
          category: hasCurrent ? n.category : undefined,
          bridgeNote: hasCurrent ? n.bridgeNote : undefined,
        });
        rowIds.push(id);
      });
      idsByRow.push(rowIds);
    });

    for (let r = 0; r < idsByRow.length - 1; r++) {
      for (const from of idsByRow[r]) {
        for (const to of idsByRow[r + 1]) edges.push({ from, to });
      }
    }

    return {
      id: "personal",
      title: str(parsed.title, 80) || data.role,
      tagline: str(parsed.tagline, 200),
      icon: "Sparkles",
      accent: "primary",
      nodes,
      edges,
    };
  });
