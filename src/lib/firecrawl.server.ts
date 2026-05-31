// Server-only Firecrawl helpers. The .server.ts suffix keeps the API key
// and SDK out of the client bundle.
import Firecrawl from "@mendable/firecrawl-js";

export interface ScrapedPage {
  url: string;
  title?: string;
  summary?: string;
  markdown?: string;
}

function getClient() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");
  return new Firecrawl({ apiKey });
}

// The SDK (v2) usually returns fields on the result object, but raw REST may
// wrap them under `data`. Normalize both shapes.
function normalize(url: string, res: unknown): ScrapedPage {
  const r = res as {
    summary?: string;
    markdown?: string;
    metadata?: { title?: string; sourceURL?: string };
    data?: { summary?: string; markdown?: string; metadata?: { title?: string } };
  };
  const summary = r?.summary ?? r?.data?.summary;
  const markdown = r?.markdown ?? r?.data?.markdown;
  const title = r?.metadata?.title ?? r?.data?.metadata?.title;
  return { url, title, summary, markdown };
}

/** Scrape a single page for its summary + main-content markdown. */
export async function scrapePage(url: string): Promise<ScrapedPage> {
  const fc = getClient();
  const res = await fc.scrape(url, {
    formats: ["summary", "markdown"],
    onlyMainContent: true,
  });
  return normalize(url, res);
}

/** Scrape many pages in one batch request. Returns a map keyed by URL. */
export async function batchScrapePages(urls: string[]): Promise<Map<string, ScrapedPage>> {
  const fc = getClient();
  const out = new Map<string, ScrapedPage>();
  if (urls.length === 0) return out;

  const res = (await fc.batchScrape(urls, {
    options: { formats: ["summary", "markdown"], onlyMainContent: true },
  })) as { data?: unknown[] };

  const items = Array.isArray(res?.data) ? res.data : [];
  for (const item of items) {
    const meta = (item as { metadata?: { sourceURL?: string } })?.metadata;
    const sourceURL = meta?.sourceURL;
    if (!sourceURL) continue;
    out.set(sourceURL, normalize(sourceURL, item));
  }
  return out;
}
