import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { streamAI, type ChatMessage } from "@/lib/ai.server";

const SYSTEM_PROMPT = `You are PathPilot, an expert career advisor for students and professionals — especially in tech and computer science.

Your job:
- Give accurate, specific, and actionable career guidance.
- Recommend concrete opportunities when relevant (e.g. GSoC, LFX Mentorship, Outreachy, Summer of Bitcoin, MLH Fellowship, ICPC, Meta Hacker Cup, Codeforces, Google STEP, Microsoft Explore, ETHGlobal, NASA Space Apps, Kleiner Perkins / Z Fellows).
- Suggest learning roadmaps and free resources (freeCodeCamp, CS50, roadmap.sh, LeetCode, NeetCode, The Odin Project, Kaggle, fast.ai).
- Tailor advice to the person's field, level, and goals. Ask a clarifying question only when essential.

Style:
- Be encouraging but honest. No hype.
- Use clean markdown: short paragraphs, bold key terms, and bullet lists.
- Keep answers focused and skimmable. Prefer specifics over generic advice.
- Never invent fake deadlines or links you are unsure about; describe typical timing instead.`;

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = BodySchema.safeParse(json);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid request" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const messages: ChatMessage[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...parsed.data.messages,
        ];

        const response = await streamAI(messages);

        if (!response.ok) {
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }
          const text = await response.text();
          console.error("AI gateway error:", response.status, text);
          return new Response(JSON.stringify({ error: "AI service error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(response.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
