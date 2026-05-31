import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { callAI, type ChatMessage } from "./ai.server";

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
