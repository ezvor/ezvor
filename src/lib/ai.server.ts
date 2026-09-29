// Multi-provider LLM layer with automatic failover.
//
// Every provider below speaks the OpenAI chat-completions protocol, so one
// client covers them all. Configure as many keys as you like; requests go to
// the first healthy provider and fail over on rate limits, outages, timeouts
// or malformed structured output.
//
//   GEMINI_API_KEY      Google AI Studio (free tier)      https://aistudio.google.com/apikey
//   GROQ_API_KEY        Groq (free tier)                  https://console.groq.com/keys
//   CEREBRAS_API_KEY    Cerebras (free tier)              https://cloud.cerebras.ai
//   OPENROUTER_API_KEY  OpenRouter (free ":free" models)  https://openrouter.ai/keys
//   MISTRAL_API_KEY     Mistral (free experiment tier)    https://console.mistral.ai
//   DEEPSEEK_API_KEY    DeepSeek (paid, very cheap)       https://platform.deepseek.com
//   AI_BASE_URL + AI_API_KEY + AI_MODEL   any other OpenAI-compatible endpoint
//
// Optional: AI_PROVIDERS="groq,gemini" to change the order, and per-provider
// model overrides (GEMINI_MODEL, GEMINI_FAST_MODEL, GROQ_MODEL, ...).

import { SITE } from "@/config/site";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type AITier = "fast" | "smart";

export type AIOptions = {
  /** "fast" for short, cheap tasks; "smart" (default) for reasoning-heavy work. */
  tier?: AITier;
  /** Legacy model hint ("...flash-lite..." maps to the fast tier). */
  model?: string;
  tools?: unknown;
  tool_choice?: unknown;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** Thinking budget hint for models that support it. */
  reasoning?: "low" | "medium" | "high";
};

type ToolDef = {
  type: "function";
  function: { name: string; description?: string; parameters?: unknown };
};

type ProviderDef = {
  id: string;
  label: string;
  url: string;
  key: () => string | undefined;
  models: (tier: AITier, key: string) => Promise<string[]>;
  headers?: () => Record<string, string>;
  /** Extra body fields for a given model. */
  extra?: (model: string, opts: AIOptions) => Record<string, unknown>;
};

const env = (...names: string[]) => {
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return undefined;
};

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];

/* ------------------------------------------------------ model discovery */

const discoveryCache = new Map<string, { at: number; models: string[] }>();

async function cached(key: string, ttlMs: number, load: () => Promise<string[]>) {
  const hit = discoveryCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.models;
  try {
    const models = await load();
    discoveryCache.set(key, { at: Date.now(), models });
    return models;
  } catch {
    discoveryCache.set(key, { at: Date.now() - ttlMs + 10 * 60_000, models: [] });
    return [];
  }
}

function versionOf(name: string): number {
  const m = /gemini-(\d+)(?:\.(\d+))?/.exec(name);
  return m ? Number(m[1]) * 100 + Number(m[2] ?? 0) : 0;
}

/** Newest stable Gemini Flash / Flash-Lite models this key can use. */
async function discoverGemini(key: string): Promise<{ flash: string[]; lite: string[] }> {
  const names = await cached("gemini", 6 * 3600_000, async () => {
    const ctrl = AbortSignal.timeout(8000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`,
      { signal: ctrl },
    );
    if (!res.ok) throw new Error(`models ${res.status}`);
    const json = (await res.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    return (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
  });
  const byVersion = (xs: string[]) => [...xs].sort((a, b) => versionOf(b) - versionOf(a));
  const plain = names.filter(
    (n) => !/tts|image|live|audio|embedding|transcribe|thinking|exp/.test(n),
  );
  return {
    flash: byVersion(
      plain.filter((n) => /^gemini-[\d.]+-flash(-preview.*)?$/.test(n) && !n.includes("lite")),
    ),
    lite: byVersion(plain.filter((n) => /^gemini-[\d.]+-flash-lite(-preview.*)?$/.test(n))),
  };
}

const OPENROUTER_PREFERENCE = [
  /deepseek\/deepseek-(chat|v3)/,
  /openai\/gpt-oss-120b/,
  /qwen\/qwen3-(coder|235b)/,
  /meta-llama\/llama-(3\.3|4)/,
  /google\/gemini/,
  /deepseek/,
  /./,
];

async function discoverOpenRouterFree(): Promise<string[]> {
  return cached("openrouter", 6 * 3600_000, async () => {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`models ${res.status}`);
    const json = (await res.json()) as { data?: { id: string; context_length?: number }[] };
    const free = (json.data ?? [])
      .filter((m) => m.id.endsWith(":free") && (m.context_length ?? 0) >= 32_000)
      .map((m) => m.id);
    const rank = (id: string) => OPENROUTER_PREFERENCE.findIndex((re) => re.test(id));
    return free.sort((a, b) => rank(a) - rank(b)).slice(0, 4);
  });
}

/* ------------------------------------------------------------ providers */

const PROVIDERS: ProviderDef[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    key: () => env("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"),
    async models(tier, key) {
      const found = await discoverGemini(key);
      return tier === "fast"
        ? uniq([
            env("GEMINI_FAST_MODEL"),
            "gemini-flash-lite-latest",
            ...found.lite,
            "gemini-flash-latest",
          ])
        : uniq([env("GEMINI_MODEL"), "gemini-flash-latest", ...found.flash]);
    },
    extra: (_model, opts) => (opts.reasoning ? { reasoning_effort: opts.reasoning } : {}),
  },
  {
    id: "groq",
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => env("GROQ_API_KEY"),
    async models(tier) {
      return tier === "fast"
        ? uniq([env("GROQ_FAST_MODEL"), "llama-3.1-8b-instant", "openai/gpt-oss-20b"])
        : uniq([env("GROQ_MODEL"), "openai/gpt-oss-120b", "llama-3.3-70b-versatile"]);
    },
    extra: (model, opts) =>
      model.startsWith("openai/gpt-oss") ? { reasoning_effort: opts.reasoning ?? "medium" } : {},
  },
  {
    id: "cerebras",
    label: "Cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    key: () => env("CEREBRAS_API_KEY"),
    async models(tier) {
      return tier === "fast"
        ? uniq([env("CEREBRAS_FAST_MODEL"), "llama3.1-8b", "gpt-oss-120b"])
        : uniq([
            env("CEREBRAS_MODEL"),
            "gpt-oss-120b",
            "qwen-3-235b-a22b-instruct-2507",
            "llama-3.3-70b",
          ]);
    },
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: () => env("OPENROUTER_API_KEY"),
    async models() {
      return uniq([env("OPENROUTER_MODEL"), ...(await discoverOpenRouterFree())]);
    },
    headers: () => ({ "HTTP-Referer": SITE.url, "X-Title": SITE.name }),
  },
  {
    id: "mistral",
    label: "Mistral",
    url: "https://api.mistral.ai/v1/chat/completions",
    key: () => env("MISTRAL_API_KEY"),
    async models(tier) {
      return tier === "fast"
        ? uniq([env("MISTRAL_FAST_MODEL"), "mistral-small-latest"])
        : uniq([env("MISTRAL_MODEL"), "mistral-medium-latest", "mistral-large-latest"]);
    },
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    url: "https://api.deepseek.com/chat/completions",
    key: () => env("DEEPSEEK_API_KEY"),
    async models() {
      return uniq([env("DEEPSEEK_MODEL"), "deepseek-chat"]);
    },
  },
  {
    id: "custom",
    label: "Custom",
    url: `${(env("AI_BASE_URL") ?? "").replace(/\/$/, "")}/chat/completions`,
    key: () => (env("AI_BASE_URL") ? (env("AI_API_KEY") ?? "none") : undefined),
    async models(tier) {
      return uniq([tier === "fast" ? env("AI_FAST_MODEL") : undefined, env("AI_MODEL")]);
    },
  },
  {
    // Keyless community endpoint — a last resort so the app keeps working with
    // zero configuration. Smaller model and lower rate limits; disable with
    // AI_KEYLESS_FALLBACK=false.
    id: "pollinations",
    label: "Pollinations (keyless)",
    url: "https://text.pollinations.ai/openai",
    key: () =>
      env("AI_KEYLESS_FALLBACK") === "false"
        ? undefined
        : (env("POLLINATIONS_API_KEY") ?? "anonymous"),
    async models() {
      return ["openai"];
    },
    headers: () => ({ Referer: SITE.url }),
  },
];

function activeProviders(): { def: ProviderDef; key: string }[] {
  const order = env("AI_PROVIDERS")
    ?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const defs = order?.length
    ? order.map((id) => PROVIDERS.find((p) => p.id === id)).filter((p): p is ProviderDef => !!p)
    : PROVIDERS;
  return defs.flatMap((def) => {
    const key = def.key();
    return key ? [{ def, key }] : [];
  });
}

export function isAIConfigured(): boolean {
  return activeProviders().length > 0;
}

export function aiProviderLabels(): string[] {
  return activeProviders().map((p) => p.def.label);
}

/* ---------------------------------------------------------- health state */

const cooldownUntil = new Map<string, number>();

function coolDown(id: string, ms: number) {
  cooldownUntil.set(id, Date.now() + ms);
}
function isCooling(id: string) {
  return (cooldownUntil.get(id) ?? 0) > Date.now();
}

function tierFor(opts: AIOptions): AITier {
  if (opts.tier) return opts.tier;
  if (opts.model && /lite|mini|small|8b|instant/i.test(opts.model)) return "fast";
  return "smart";
}

/* ------------------------------------------------- structured-output glue */

function extractJsonText(raw: string): string | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.search(/[{[]/);
  if (start === -1) return null;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  const end = s.lastIndexOf(close);
  if (end <= start) return null;
  const candidate = s.slice(start, end + 1);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function forcedToolName(opts: AIOptions): string | null {
  const tc = opts.tool_choice as { function?: { name?: string } } | undefined;
  if (tc?.function?.name) return tc.function.name;
  const tools = (opts.tools as ToolDef[] | undefined) ?? [];
  return tools.length === 1 ? tools[0].function.name : null;
}

type Completion = {
  choices?: {
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: {
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string;
  }[];
};

/**
 * Make sure a completion that was asked for a tool call actually carries a
 * parseable one. Models that answer in plain JSON text are normalised into a
 * synthetic tool call so callers can treat every provider the same way.
 */
function normaliseToolCompletion(json: Completion, toolName: string): Completion | null {
  const msg = json.choices?.[0]?.message;
  if (!msg) return null;
  const call =
    msg.tool_calls?.find((c) => !c.function?.name || c.function.name === toolName) ??
    msg.tool_calls?.[0];
  const args = call?.function?.arguments;
  if (args) {
    try {
      JSON.parse(args);
      return json;
    } catch {
      const repaired = extractJsonText(args);
      if (repaired) {
        call!.function!.arguments = repaired;
        return json;
      }
    }
  }
  const fromContent = msg.content ? extractJsonText(msg.content) : null;
  if (!fromContent) return null;
  return {
    ...json,
    choices: [
      {
        ...json.choices![0],
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_0",
              type: "function",
              function: { name: toolName, arguments: fromContent },
            },
          ],
        },
      },
    ],
  };
}

function jsonInstruction(opts: AIOptions): string {
  const tools = (opts.tools as ToolDef[] | undefined) ?? [];
  const name = forcedToolName(opts);
  const tool = tools.find((t) => t.function.name === name) ?? tools[0];
  return `Respond with ONLY a JSON object (no prose, no markdown fences) that is a valid argument object for the function "${tool?.function.name}"${
    tool?.function.description ? ` (${tool.function.description})` : ""
  }. It must match this JSON Schema:\n${JSON.stringify(tool?.function.parameters ?? {})}`;
}

/* ------------------------------------------------------------ transport */

class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function post(
  def: ProviderDef,
  key: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<Response> {
  const res = await fetch(def.url, {
    method: "POST",
    headers: {
      ...(key === "anonymous" ? {} : { Authorization: `Bearer ${key}` }),
      "Content-Type": "application/json",
      ...(def.headers?.() ?? {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((e: unknown) => {
    throw new ProviderError(e instanceof Error ? e.message : "network error", 0, true);
  });
  if (res.ok) return res;
  const text = await res.text().catch(() => "");
  const retryable =
    res.status === 429 || res.status >= 500 || res.status === 404 || res.status === 408;
  throw new ProviderError(`${def.id} ${res.status}: ${text.slice(0, 300)}`, res.status, retryable);
}

function buildBody(
  model: string,
  messages: ChatMessage[],
  opts: AIOptions,
  def: ProviderDef,
  mode: "tools" | "json" | "plain",
  stream = false,
): Record<string, unknown> {
  const body: Record<string, unknown> = { model, messages, ...(def.extra?.(model, opts) ?? {}) };
  if (opts.temperature != null) body.temperature = opts.temperature;
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (stream) body.stream = true;
  if (mode === "tools") {
    // Some backends reject tools without a description.
    body.tools = ((opts.tools as ToolDef[] | undefined) ?? []).map((t) => ({
      ...t,
      function: { ...t.function, description: t.function.description ?? t.function.name },
    }));
    if (opts.tool_choice) body.tool_choice = opts.tool_choice;
  } else if (mode === "json") {
    body.messages = [
      ...messages.slice(0, -1),
      {
        role: "user",
        content: `${messages[messages.length - 1]?.content ?? ""}\n\n${jsonInstruction(opts)}`,
      },
    ];
  }
  return body;
}

function jsonResponse(payload: unknown, status = 200, provider?: string): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(provider ? { "x-ai-provider": provider } : {}),
    },
  });
}

/**
 * Non-streaming completion with failover. Returns a `Response` whose JSON body
 * is an OpenAI-style completion. When `tools` are passed, the first choice is
 * guaranteed to carry a parseable tool call (or the response is not ok).
 */
export async function callAI(messages: ChatMessage[], opts: AIOptions = {}): Promise<Response> {
  const providers = activeProviders();
  if (!providers.length) {
    return jsonResponse(
      {
        error:
          "No AI provider configured. Add GEMINI_API_KEY (free at https://aistudio.google.com/apikey) to your environment.",
      },
      503,
    );
  }

  const tier = tierFor(opts);
  const wantsTool = !!opts.tools;
  const toolName = wantsTool ? forcedToolName(opts) : null;
  const timeoutMs = opts.timeoutMs ?? (tier === "fast" ? 45_000 : 120_000);
  let lastStatus = 503;
  const errors: string[] = [];

  const ordered = [...providers].sort(
    (a, b) => Number(isCooling(a.def.id)) - Number(isCooling(b.def.id)),
  );
  for (const { def, key } of ordered) {
    const models = await def.models(tier, key).catch(() => [] as string[]);
    for (const model of models) {
      const slot = `${def.id}:${model}`;
      if (isCooling(slot)) continue;
      const modes: ("tools" | "json" | "plain")[] = wantsTool ? ["tools", "json"] : ["plain"];
      for (const mode of modes) {
        try {
          const res = await post(def, key, buildBody(model, messages, opts, def, mode), timeoutMs);
          const json = (await res.json()) as Completion;
          if (wantsTool && toolName) {
            const normalised = normaliseToolCompletion(json, toolName);
            if (normalised) return jsonResponse(normalised, 200, `${def.id}/${model}`);
            errors.push(`${slot} (${mode}): no usable structured output`);
            if (process.env.AI_DEBUG)
              console.warn(`[ai] ${slot} raw:`, JSON.stringify(json).slice(0, 1500));
            continue; // try JSON mode, then the next model/provider
          }
          if (!json.choices?.[0]?.message) {
            errors.push(`${slot}: empty completion`);
            break;
          }
          return jsonResponse(json, 200, `${def.id}/${model}`);
        } catch (e) {
          const err = e instanceof ProviderError ? e : new ProviderError(String(e), 0, true);
          errors.push(`${slot} (${mode}): ${err.message}`);
          lastStatus = err.status || lastStatus;
          if (err.status === 400 && mode === "tools") continue; // tools unsupported → JSON mode
          if (err.status === 401 || err.status === 403) {
            coolDown(def.id, 3600_000);
            break;
          }
          if (err.status === 404) coolDown(slot, 3600_000);
          else if (err.status === 429) coolDown(slot, 60_000);
          else if (err.retryable) coolDown(slot, 20_000);
          break;
        }
      }
      if (isCooling(def.id)) break;
    }
  }

  console.error("[ai] all providers failed:", errors.slice(-8).join(" | "));
  return jsonResponse(
    { error: "AI is temporarily unavailable. Please try again shortly." },
    lastStatus === 429 ? 429 : 503,
  );
}

/**
 * Streaming completion with failover before the first byte. Returns the raw
 * OpenAI-style SSE response of the first provider that accepts the request.
 */
export async function streamAI(
  messages: ChatMessage[],
  optsOrModel: AIOptions | string = {},
): Promise<Response> {
  const opts: AIOptions = typeof optsOrModel === "string" ? { model: optsOrModel } : optsOrModel;
  const providers = activeProviders();
  if (!providers.length) {
    return jsonResponse({ error: "No AI provider configured." }, 503);
  }
  const tier = tierFor(opts);
  let lastStatus = 503;
  const ordered = [...providers].sort(
    (a, b) => Number(isCooling(a.def.id)) - Number(isCooling(b.def.id)),
  );
  for (const { def, key } of ordered) {
    const models = await def.models(tier, key).catch(() => [] as string[]);
    for (const model of models) {
      const slot = `${def.id}:${model}`;
      if (isCooling(slot)) continue;
      try {
        const res = await post(
          def,
          key,
          buildBody(model, messages, opts, def, "plain", true),
          opts.timeoutMs ?? 30_000,
        );
        const headers = new Headers(res.headers);
        headers.set("x-ai-provider", `${def.id}/${model}`);
        return new Response(res.body, { status: 200, headers });
      } catch (e) {
        const err = e instanceof ProviderError ? e : new ProviderError(String(e), 0, true);
        lastStatus = err.status || lastStatus;
        if (err.status === 401 || err.status === 403) {
          coolDown(def.id, 3600_000);
          break;
        }
        coolDown(slot, err.status === 429 ? 60_000 : err.status === 404 ? 3600_000 : 20_000);
      }
    }
  }
  return jsonResponse(
    { error: "AI is temporarily unavailable. Please try again shortly." },
    lastStatus === 429 ? 429 : 503,
  );
}

/* ------------------------------------------------------------- helpers */

/** Plain-text completion. Throws when every provider fails. */
export async function aiText(messages: ChatMessage[], opts: AIOptions = {}): Promise<string> {
  const res = await callAI(messages, opts);
  const json = (await res.json()) as Completion & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `AI request failed (${res.status})`);
  return json.choices?.[0]?.message?.content ?? "";
}

/** Structured completion: the model must return arguments matching `parameters`. */
export async function aiJSON<T>(
  messages: ChatMessage[],
  schema: { name: string; description?: string; parameters: Record<string, unknown> },
  opts: Omit<AIOptions, "tools" | "tool_choice"> = {},
): Promise<T> {
  const res = await callAI(messages, {
    ...opts,
    tools: [{ type: "function", function: schema }],
    tool_choice: { type: "function", function: { name: schema.name } },
  });
  const json = (await res.json()) as Completion & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `AI request failed (${res.status})`);
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured output");
  return JSON.parse(args) as T;
}
