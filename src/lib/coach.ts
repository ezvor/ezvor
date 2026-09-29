// AI Coach: shared request types, limits and the browser-side stream reader.
// The server route lives in src/routes/api/coach.ts and builds the prompt from
// the trusted problem statement; clients only send the slug, their code and
// the conversation.

import type { LangKey } from "@/lib/judge/languages";

export const COACH_INTENTS = ["chat", "hint", "debug", "complexity", "review", "explain"] as const;
export type CoachIntent = (typeof COACH_INTENTS)[number];

export const COACH_LIMITS = {
  code: 20_000,
  message: 6_000,
  messages: 24,
  field: 4_000,
} as const;

export type CoachMessage = { role: "user" | "assistant"; content: string };

/** The last failing Run/Submit, forwarded so the coach can debug it. */
export type CoachFailure = {
  source: "run" | "submit";
  verdict: string;
  input?: string;
  expected?: string;
  got?: string;
  stderr?: string;
  compileError?: string;
  passed?: number;
  total?: number;
  hidden?: boolean;
};

export type CoachRequest = {
  slug: string;
  language: LangKey;
  intent: CoachIntent;
  /** 1 = nudge, 2 = hint, 3 = approach outline. */
  hintLevel?: 1 | 2 | 3;
  code?: string;
  lastResult?: CoachFailure | null;
  messages: CoachMessage[];
};

export type QuickAction = { intent: Exclude<CoachIntent, "chat">; label: string; prompt: string };

export const QUICK_ACTIONS: QuickAction[] = [
  { intent: "hint", label: "Hint", prompt: "Give me a hint." },
  { intent: "debug", label: "Why is my code failing?", prompt: "Why is my code failing?" },
  {
    intent: "complexity",
    label: "Analyze complexity",
    prompt: "Analyze the time and space complexity of my code.",
  },
  { intent: "review", label: "Review my code", prompt: "Review my code." },
  {
    intent: "explain",
    label: "Explain the optimal approach",
    prompt: "Explain the optimal approach.",
  },
];

export const HINT_PROMPTS: Record<1 | 2 | 3, string> = {
  1: "Give me a small nudge.",
  2: "I need a stronger hint.",
  3: "Outline the approach for me.",
};

function clip(s: string | undefined, max: number): string | undefined {
  if (s == null) return undefined;
  return s.length > max ? `${s.slice(0, max)}\n…[truncated]` : s;
}

/** Trim a request so it always fits the server's validation limits. */
export function clampCoachRequest(req: CoachRequest): CoachRequest {
  const f = req.lastResult;
  return {
    ...req,
    code: clip(req.code, COACH_LIMITS.code),
    lastResult: f
      ? {
          ...f,
          verdict: f.verdict.slice(0, 60),
          input: clip(f.input, COACH_LIMITS.field),
          expected: clip(f.expected, COACH_LIMITS.field),
          got: clip(f.got, COACH_LIMITS.field),
          stderr: clip(f.stderr, COACH_LIMITS.field),
          compileError: clip(f.compileError, COACH_LIMITS.field),
        }
      : f,
    messages: req.messages
      .slice(-COACH_LIMITS.messages)
      .map((m) => ({ role: m.role, content: clip(m.content, COACH_LIMITS.message) ?? "" }))
      .filter((m) => m.content.trim().length > 0),
  };
}

/**
 * POST to /api/coach and stream the reply. Calls `onDelta` with each text
 * chunk and resolves with the full answer. Throws with the server's message.
 */
export async function streamCoach(
  req: CoachRequest,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const resp = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clampCoachRequest(req)),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const err = (await resp.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? "The coach is unavailable right now.");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") return full;
      try {
        const parsed = JSON.parse(json) as { choices?: { delta?: { content?: string } }[] };
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) {
          full += chunk;
          onDelta(chunk);
        }
      } catch {
        /* complete line that isn't JSON (keep-alive / provider noise) */
      }
    }
  }
  return full;
}
