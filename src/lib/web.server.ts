// Web search + page reading with free fallbacks.
//
// Search:  Firecrawl (FIRECRAWL_API_KEY) → Tavily (TAVILY_API_KEY) →
//          Brave (BRAVE_SEARCH_API_KEY) → DuckDuckGo HTML (keyless).
// Read:    Firecrawl → Jina Reader (keyless, JINA_API_KEY optional) → direct fetch.
//
// With no keys at all, everything still works through the keyless services.

export type SearchHit = {
  title: string;
  url: string;
  description: string;
  /** Page content as markdown, when the provider returned it. */
  markdown?: string;
};

export type Freshness = "day" | "week" | "month" | undefined;

export type ScrapedPage = {
  url: string;
  title?: string;
  summary?: string;
  markdown?: string;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

async function fetchText(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { "user-agent": UA, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------- search */

async function firecrawlSearch(
  query: string,
  limit: number,
  freshness: Freshness,
): Promise<SearchHit[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("no key");
  const tbs =
    freshness === "day"
      ? "qdr:d"
      : freshness === "week"
        ? "qdr:w"
        : freshness === "month"
          ? "qdr:m"
          : undefined;
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, tbs }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`firecrawl ${res.status}`);
  const json = (await res.json()) as {
    data?: { web?: SearchHit[] } | SearchHit[];
  };
  const rows = Array.isArray(json.data) ? json.data : (json.data?.web ?? []);
  return rows
    .filter((r) => r.url)
    .map((r) => ({
      title: r.title ?? r.url,
      url: r.url,
      description: r.description ?? "",
      markdown: r.markdown,
    }));
}

async function tavilySearch(
  query: string,
  limit: number,
  freshness: Freshness,
): Promise<SearchHit[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("no key");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: limit, time_range: freshness }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const json = (await res.json()) as {
    results?: { title: string; url: string; content?: string }[];
  };
  return (json.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.content ?? "",
  }));
}

async function braveSearch(
  query: string,
  limit: number,
  freshness: Freshness,
): Promise<SearchHit[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error("no key");
  const f =
    freshness === "day" ? "pd" : freshness === "week" ? "pw" : freshness === "month" ? "pm" : "";
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(limit, 20)}${f ? `&freshness=${f}` : ""}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`brave ${res.status}`);
  const json = (await res.json()) as {
    web?: { results?: { title: string; url: string; description?: string }[] };
  };
  return (json.web?.results ?? []).map((r) => ({
    title: stripTags(r.title),
    url: r.url,
    description: stripTags(r.description ?? ""),
  }));
}

// DuckDuckGo's HTML endpoint is keyless but throttles bursts with a bot
// challenge. Requests are spaced out, and once the challenge appears we stop
// asking for a while instead of waiting on pages that will never have results.
const DDG_SPACING_MS = 1_100;
const DDG_COOLDOWN_MS = 15 * 60_000;
let ddgNextSlot = 0;
let ddgBlockedUntil = 0;

async function ddgTurn(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, ddgNextSlot);
  ddgNextSlot = slot + DDG_SPACING_MS;
  if (slot - now > 8_000) throw new Error("duckduckgo queue full");
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

async function duckduckgoSearch(
  query: string,
  limit: number,
  freshness: Freshness,
): Promise<SearchHit[]> {
  if (Date.now() < ddgBlockedUntil) throw new Error("duckduckgo is throttling this server");
  await ddgTurn();
  const df =
    freshness === "day" ? "d" : freshness === "week" ? "w" : freshness === "month" ? "m" : "";
  const html = await fetchText(
    "https://html.duckduckgo.com/html/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ q: query, ...(df ? { df } : {}) }).toString(),
    },
    10_000,
  );
  if (/anomaly-modal|bots use DuckDuckGo|challenge-form/i.test(html)) {
    ddgBlockedUntil = Date.now() + DDG_COOLDOWN_MS;
    console.warn(
      "[web] DuckDuckGo is rate-limiting this server; pausing keyless search for 15 min",
    );
    throw new Error("duckduckgo challenge");
  }
  const hits: SearchHit[] = [];
  const blocks = html.split(/<div[^>]+class="[^"]*\bresult\b[^"]*"/).slice(1);
  for (const block of blocks) {
    const link = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!link) continue;
    let url = decodeEntities(link[1]);
    const redirect = /[?&]uddg=([^&]+)/.exec(url);
    if (redirect) url = decodeURIComponent(redirect[1]);
    if (url.startsWith("//")) url = `https:${url}`;
    if (!/^https?:\/\//.test(url) || /duckduckgo\.com\/y\.js/.test(url)) continue;
    const snippet = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    hits.push({
      title: stripTags(link[2]),
      url,
      description: snippet ? stripTags(snippet[1]) : "",
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

const searchCache = new Map<string, { at: number; hits: SearchHit[] }>();
const SEARCH_TTL_MS = 10 * 60_000;

/** True when at least one keyed search provider is configured. */
export function hasSearchKey(): boolean {
  return !!(
    process.env.FIRECRAWL_API_KEY ||
    process.env.TAVILY_API_KEY ||
    process.env.BRAVE_SEARCH_API_KEY
  );
}

/**
 * Web search with automatic provider fallback. Never throws; returns [] when
 * all fail. Results are cached per instance for 10 minutes.
 */
export async function webSearch(
  query: string,
  opts: { limit?: number; freshness?: Freshness } = {},
): Promise<SearchHit[]> {
  const limit = opts.limit ?? 8;
  const key = `${opts.freshness ?? ""}|${limit}|${query.trim().toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.hits;

  for (const provider of [firecrawlSearch, tavilySearch, braveSearch, duckduckgoSearch]) {
    try {
      const hits = await provider(query, limit, opts.freshness);
      if (hits.length) {
        searchCache.set(key, { at: Date.now(), hits });
        if (searchCache.size > 300) searchCache.delete(searchCache.keys().next().value!);
        return hits;
      }
    } catch {
      /* try the next provider */
    }
  }
  return [];
}

/* --------------------------------------------------------------- read */

async function firecrawlScrape(url: string): Promise<ScrapedPage> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("no key");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown", "summary"], onlyMainContent: true }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`firecrawl ${res.status}`);
  const json = (await res.json()) as {
    data?: { markdown?: string; summary?: string; metadata?: { title?: string } };
  };
  return {
    url,
    title: json.data?.metadata?.title,
    summary: json.data?.summary,
    markdown: json.data?.markdown,
  };
}

async function jinaRead(url: string): Promise<ScrapedPage> {
  const headers: Record<string, string> = { Accept: "text/plain", "X-Return-Format": "markdown" };
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
  const text = await fetchText(`https://r.jina.ai/${url}`, { headers }, 30_000);
  const title = /^Title:\s*(.+)$/m.exec(text)?.[1]?.trim();
  const body = text.split(/^Markdown Content:\s*$/m)[1] ?? text;
  if (body.trim().length < 80) throw new Error("empty page");
  return { url, title, markdown: body.trim() };
}

async function directRead(url: string): Promise<ScrapedPage> {
  const html = await fetchText(url, { headers: { Accept: "text/html" } });
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const main =
    /<main[\s\S]*?<\/main>/i.exec(html)?.[0] ??
    /<article[\s\S]*?<\/article>/i.exec(html)?.[0] ??
    html;
  const text = main
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h\d|tr|section)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const markdown = decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { url, title: title ? stripTags(title) : undefined, markdown };
}

/** Read a page as markdown-ish text with automatic fallback. */
export async function scrapePage(url: string): Promise<ScrapedPage> {
  let lastError: unknown;
  for (const reader of [firecrawlScrape, jinaRead, directRead]) {
    try {
      const page = await reader(url);
      if (page.markdown || page.summary) {
        return { ...page, markdown: page.markdown?.slice(0, 40_000) };
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Couldn't read ${url}`);
}

/** Read many pages (bounded concurrency). Missing pages are simply absent from the map. */
export async function batchScrapePages(
  urls: string[],
  concurrency = 4,
): Promise<Map<string, ScrapedPage>> {
  const out = new Map<string, ScrapedPage>();
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
      while (i < urls.length) {
        const url = urls[i++];
        try {
          out.set(url, await scrapePage(url));
        } catch {
          /* skip */
        }
      }
    }),
  );
  return out;
}
