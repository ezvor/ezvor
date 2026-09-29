import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { streamAI, type ChatMessage } from "@/lib/ai.server";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit.server";

const SYSTEM_PROMPT = `You are Ezvor, an expert career advisor for students and professionals — especially in tech and computer science.

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
        try {
          enforceRateLimit("chat", { request });
        } catch (e) {
          if (e instanceof RateLimitError) {
            return new Response(JSON.stringify({ error: e.message }), {
              status: 429,
              headers: { "Content-Type": "application/json", "Retry-After": String(e.retryAfterSec) },
            });
          }
          throw e;
        }

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

        const response = await streamAI(messages, { tier: "smart", reasoning: "low" });

        if (!response.ok) {
          const status = response.status === 429 ? 429 : 503;
          return new Response(
            JSON.stringify({
              error:
                status === 429
                  ? "The AI is busy right now. Please try again in a moment."
                  : "The AI service is temporarily unavailable. Please try again shortly.",
            }),
            { status, headers: { "Content-Type": "application/json" } },
          );
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
