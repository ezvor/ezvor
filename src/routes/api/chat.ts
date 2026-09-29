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

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

/**
 * `/api/chat` is a plain server route, so the server-function CSRF middleware
 * doesn't cover it. Only accept requests the browser marks as same-origin, so
 * other sites can't spend this deployment's AI quota from their visitors' tabs.
 */
function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return false;
    }
    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host") ||
      new URL(request.url).host;
    return originHost === host;
  }
  // No Origin header: non-browser clients (curl, server-to-server). Browsers
  // always send Origin on cross-origin POSTs, so this can't be a CSRF vector.
  return true;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) {
          return json({ error: "Cross-origin requests are not allowed." }, 403);
        }

        try {
          enforceRateLimit("chat", { request });
        } catch (e) {
          if (e instanceof RateLimitError) {
            return json({ error: e.message }, 429, { "Retry-After": String(e.retryAfterSec) });
          }
          throw e;
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid request" }, 400);

        const messages: ChatMessage[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...parsed.data.messages,
        ];

        let response: Response;
        try {
          response = await streamAI(messages, { tier: "smart", reasoning: "low" });
        } catch (e) {
          console.error("[chat] AI request failed", e);
          return json(
            { error: "The AI service is temporarily unavailable. Please try again shortly." },
            503,
          );
        }

        if (!response.ok || !response.body) {
          const status = response.status === 429 ? 429 : 503;
          return json(
            {
              error:
                status === 429
                  ? "The AI is busy right now. Please try again in a moment."
                  : "The AI service is temporarily unavailable. Please try again shortly.",
            },
            status,
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
