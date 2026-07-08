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
          "- \"transfer\": a skill the learner ALREADY HAS that carries over directly. Do NOT teach it again; briefly say how it applies in the new role. Keep these to the first stage(s).",
          "- \"bridge\": something the learner partially knows but must REFRAME or EXTEND (e.g. an SQA engineer already writes test cases, so they bridge into CI test automation / pipeline gates). Explain the delta from what they do today.",
          "- \"new\": a net-new skill they must learn from scratch. Go deeper here since this is where the real gap is.",
          "For EVERY node also fill `bridgeNote`: one concrete sentence relating it to the learner's stated background (e.g. 'You already validate APIs manually — now assert them inside a pipeline stage').",
          "",
          "Order stages so early stages leverage transferable strengths, middle stages bridge, and later stages build the missing core of the target role, ending job-ready. 4-6 stages, 1-2 nodes each, and give each stage a short `title`.",
          "Be specific and accurate to the ACTUAL transition named (do not invent a generic path). Every node MUST include 1-3 FREE resources, preferring specific YouTube channels/playlists (freeCodeCamp, NeetCode, TechWorld with Nana, KodeKloud, Krish Naik, StatQuest, Corey Schafer) matching the topic. Use real, working URLs.",
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

    const tools = [
      {
        type: "function",
        function: {
          name: "build_graph",
          description: "Return a staged transition/skill graph with free resources per node.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "The transition, e.g. 'SQA Engineer -> DevOps'." },
              tagline: { type: "string", description: "One sentence naming the biggest gap to close." },
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
                          category: {
                            type: "string",
                            enum: ["transfer", "bridge", "new"],
                            description:
                              "transfer = already have it; bridge = reframe/extend existing skill; new = learn from scratch.",
                          },
                          bridgeNote: {
                            type: "string",
                            description: "One sentence relating this node to the learner's current background.",
                          },
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
                        required: ["label", "desc", "category", "bridgeNote", "resources"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["title", "nodes"],
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
        title?: string;
        nodes: {
          label: string;
          desc: string;
          category?: "transfer" | "bridge" | "new";
          bridgeNote?: string;
          resources: GraphNode["resources"];
        }[];
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
        nodes.push({
          id,
          label: n.label,
          desc: n.desc,
          row,
          col,
          resources: n.resources ?? [],
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
      title: parsed.title,
      tagline: parsed.tagline,
      icon: "Sparkles",
      accent: "primary",
      nodes,
      edges,
    };
  });
