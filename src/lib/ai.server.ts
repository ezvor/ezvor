// AI provider layer.
//
// Two ways to reach Google Gemini models, picked automatically at runtime:
//
//   1. Lovable AI Gateway  -> used when LOVABLE_API_KEY exists.
//      This is auto-injected ONLY inside Lovable's hosting (preview +
//      *.lovable.app). It does NOT exist locally or on Vercel.
//
//   2. Google Gemini direct -> used when GEMINI_API_KEY (or GOOGLE_API_KEY)
//      exists. This is Google's free OpenAI-compatible endpoint. Get a free
//      key at https://aistudio.google.com/apikey and set it in your local
//      .env and in Vercel project env vars. Same Gemini models = same
//      accuracy you get inside Lovable.
//
// The Gemini path is OpenAI-compatible, so request/response shapes (including
// tool calling and streaming) are identical — only the URL, auth header and
// model id change.

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

type Provider = {
  url: string;
  key: string;
  /** Map a Lovable-style model id to one this provider understands. */
  model: (model: string) => string;
};

/**
 * Decide which provider to use. Prefers Lovable's gateway (inside Lovable),
 * then falls back to a direct Google Gemini key for local / Vercel.
 */
function getProvider(): Provider {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    return { url: LOVABLE_URL, key: lovableKey, model: (m) => m };
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    return { url: GEMINI_URL, key: geminiKey, model: toGeminiModel };
  }

  throw new Error(
    "No AI key configured. Set GEMINI_API_KEY (free, from https://aistudio.google.com/apikey) " +
      "in your .env locally and in your Vercel project settings.",
  );
}

/**
 * Google's public API doesn't expose Lovable's preview model aliases, so map
 * them to the closest stable Gemini model. Strips the "google/" prefix and
 * normalizes preview/flash/pro variants.
 */
function toGeminiModel(model: string): string {
  const m = model.replace(/^google\//, "").toLowerCase();
  if (m.includes("pro")) return "gemini-2.5-pro";
  if (m.includes("flash-lite") || m.includes("flash-lite-preview")) return "gemini-2.5-flash-lite";
  // Everything else (incl. the flash-preview default) -> stable flash.
  return "gemini-2.5-flash";
}

/** Non-streaming completion. Returns the raw fetch Response. */
export async function callAI(
  messages: ChatMessage[],
  opts: { model?: string; tools?: unknown; tool_choice?: unknown } = {},
): Promise<Response> {
  const provider = getProvider();

  const body: Record<string, unknown> = {
    model: provider.model(opts.model ?? DEFAULT_MODEL),
    messages,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;

  return fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Streaming completion — returns the raw SSE Response body to forward to the client. */
export async function streamAI(messages: ChatMessage[], model?: string): Promise<Response> {
  const provider = getProvider();

  return fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model(model ?? DEFAULT_MODEL),
      messages,
      stream: true,
    }),
  });
}
