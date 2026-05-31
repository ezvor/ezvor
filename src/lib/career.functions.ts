import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { callAI, type ChatMessage } from "./ai.server";
import type { GraphRoadmap, GraphNode, GraphEdge } from "@/data/graphData";

interface ToolCallResult {
  choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
}

function extractToolArgs(data: ToolCallResult): unknown {
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("No structured output returned");
  return JSON.parse(args);
}

/** Generate a personalized learning roadmap for any role or goal. */
export const generateRoadmap = createServerFn({ method: "POST" })
  .inputValidator(z.object({ goal: z.string().min(2).max(120) }))
  .handler(async ({ data }) => {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a career mentor. Build a realistic, modern learning roadmap with 4-5 progressive stages. Each stage has 3-5 concrete, specific items. Be accurate and practical.",
      },
      { role: "user", content: `Create a step-by-step roadmap to become a ${data.goal}.` },
    ];

    const tools = [
      {
        type: "function",
        function: {
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
                  additionalProperties: false,
                },
              },
            },
            required: ["role", "summary", "duration", "stages"],
            additionalProperties: false,
          },
        },
      },
    ];

    const res = await callAI(messages, {
      tools,
      tool_choice: { type: "function", function: { name: "build_roadmap" } },
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error("AI service error");
    }

    const data2 = (await res.json()) as ToolCallResult;
    return extractToolArgs(data2) as {
      role: string;
      summary: string;
      duration: string;
      stages: { title: string; items: string[] }[];
    };
  });

/** Discover opportunities tailored to a field or interest. */
export const discoverOpportunities = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string().min(2).max(160) }))
  .handler(async ({ data }) => {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a career-opportunities curator. List real, well-known programs (scholarships, internships, open-source mentorships, hackathons, contests, fellowships) relevant to the user's interest. Only include real programs you are confident exist. Describe typical timing rather than exact dates.",
      },
      {
        role: "user",
        content: `Find 6 relevant opportunities for someone interested in: ${data.query}.`,
      },
    ];

    const tools = [
      {
        type: "function",
        function: {
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
                    difficulty: { type: "string", enum: ["Beginner", "Intermediate", "Advanced"] },
                  },
                  required: ["title", "org", "category", "blurb", "timing", "eligibility", "difficulty"],
                  additionalProperties: false,
                },
              },
            },
            required: ["opportunities"],
            additionalProperties: false,
          },
        },
      },
    ];

    const res = await callAI(messages, {
      tools,
      tool_choice: { type: "function", function: { name: "list_opportunities" } },
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error("AI service error");
    }

    const data2 = (await res.json()) as ToolCallResult;
    return extractToolArgs(data2) as {
      opportunities: {
        title: string;
        org: string;
        category: string;
        blurb: string;
        timing: string;
        eligibility: string;
        difficulty: string;
      }[];
    };
  });

/** Generate a personalized, NeetCode-style skill graph from current skills + target role. */
export const generatePersonalGraph = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      role: z.string().min(2).max(80),
      skills: z.string().max(400).optional(),
    }),
  )
  .handler(async ({ data }): Promise<GraphRoadmap> => {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a career mentor building a visual skill roadmap. Given a target role and the learner's current skills, produce 4-6 ordered stages from foundations to job-ready. SKIP or shorten topics the learner already knows and go deeper on what they're missing. Each stage has 1-2 nodes. Every node MUST include 1-3 FREE resources, preferring specific YouTube channels/playlists (e.g. freeCodeCamp, NeetCode, TechWorld with Nana, Krish Naik, StatQuest, Corey Schafer) that match the topic. Use real, working URLs.",
      },
      {
        role: "user",
        content: `Target role: ${data.role}\nCurrent skills: ${data.skills?.trim() || "beginner / not specified"}`,
      },
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "build_graph",
          description: "Return a staged skill graph with free resources per node.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              tagline: { type: "string", description: "One short sentence." },
              stages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nodes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string" },
                          desc: { type: "string" },
                          resources: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                label: { type: "string" },
                                provider: { type: "string" },
                                url: { type: "string" },
                                kind: {
                                  type: "string",
                                  enum: ["Video", "Playlist", "Practice", "Docs", "Course"],
                                },
                              },
                              required: ["label", "provider", "url", "kind"],
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ["label", "desc", "resources"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["nodes"],
                  additionalProperties: false,
                },
              },
            },
            required: ["title", "tagline", "stages"],
            additionalProperties: false,
          },
        },
      },
    ];

    const res = await callAI(messages, {
      tools,
      tool_choice: { type: "function", function: { name: "build_graph" } },
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error("AI service error");
    }

    const out = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const argStr = out?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argStr) throw new Error("No graph returned");

    const parsed = JSON.parse(argStr) as {
      title: string;
      tagline: string;
      stages: {
        nodes: { label: string; desc: string; resources: GraphNode["resources"] }[];
      }[];
    };

    // Lay out stages into rows; nodes spread across columns.
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const idsByRow: string[][] = [];

    parsed.stages.forEach((stage, row) => {
      const rowIds: string[] = [];
      const count = Math.max(stage.nodes.length, 1);
      stage.nodes.forEach((n, i) => {
        const id = `s${row}n${i}`;
        const col = count === 1 ? 0.5 : 0.25 + (i * 0.5) / (count - 1);
        nodes.push({ id, label: n.label, desc: n.desc, row, col, resources: n.resources ?? [] });
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
      title: parsed.title,
      tagline: parsed.tagline,
      icon: "Sparkles",
      accent: "primary",
      nodes,
      edges,
    };
  });
