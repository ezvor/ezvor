const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function getApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

/** Non-streaming completion. Returns the assistant text. */
export async function callAI(
  messages: ChatMessage[],
  opts: { model?: string; tools?: unknown; tool_choice?: unknown } = {},
): Promise<Response> {
  const body: Record<string, unknown> = {
    model: opts.model ?? "google/gemini-3-flash-preview",
    messages,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;

  return fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Streaming completion — returns the raw SSE Response body to forward to the client. */
export async function streamAI(messages: ChatMessage[], model?: string): Promise<Response> {
  return fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model ?? "google/gemini-3-flash-preview",
      messages,
      stream: true,
    }),
  });
}
