// Server-only job search across the major hiring platforms.
//
// Accuracy strategy (targets ~95%+ precision):
//   1. Query many high-signal sources in parallel — the big boards
//      (LinkedIn / Indeed / Glassdoor), the ATS platforms where companies
//      post directly (Greenhouse / Lever / Ashby), Y Combinator's Work at a
//      Startup, and the top remote boards.
//   2. Feed EVERY raw web result to the AI as a numbered list and ask it to
//      return only rows that are (a) a single real job posting — not a search,
//      category or company page, (b) relevant to the query, (c) matching the
//      requested location + work mode, and (d) currently open. The AI answers
//      with the ROW INDEX so URLs can never be hallucinated — we always keep
//      the real scraped URL.
//   3. Fall back to a heuristic parser when no AI key is present.
import Firecrawl from "@mendable/firecrawl-js";

import { callAI, type ChatMessage } from "./ai.server";

export interface JobResult {
  title: string;
  company: string;
  location: string;
  source: "LinkedIn" | "Indeed" | "Glassdoor" | "Greenhouse" | "Lever" | "YC" | "Remote";
  workMode: "Remote" | "Onsite" | "Hybrid" | "Unspecified";
  url: string;
  description: string;
  postedText?: string;
  confidence?: number;
}

type Timeframe = "Any time" | "Past 24 hours" | "Past 3 days" | "Past week" | "Past month";
type WorkMode = "Any" | "Remote" | "Onsite" | "Hybrid";

interface SearchArgs {
  query: string;
  timeframe: Timeframe;
  workMode: WorkMode;
  location: string;
  sources?: string[];
}

function getClient() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");
  return new Firecrawl({ apiKey });
}

// Firecrawl/Google time-based-search codes.
function tbsFor(t: Timeframe): string | undefined {
  switch (t) {
    case "Past 24 hours":
      return "qdr:d";
    case "Past 3 days":
    case "Past week":
      return "qdr:w";
    case "Past month":
      return "qdr:m";
    default:
      return undefined;
  }
}

// Each filter key maps to one or more real sites. `source` drives the badge.
const PLATFORMS: {
  key: string;
  source: JobResult["source"];
  site: string;
  limit: number;
}[] = [
  { key: "LinkedIn", source: "LinkedIn", site: "linkedin.com/jobs/view", limit: 10 },
  { key: "Indeed", source: "Indeed", site: "indeed.com/viewjob OR indeed.com/job", limit: 8 },
  { key: "Glassdoor", source: "Glassdoor", site: "glassdoor.com/job-listing OR glassdoor.com/Job", limit: 6 },
  { key: "Greenhouse", source: "Greenhouse", site: "boards.greenhouse.io OR job-boards.greenhouse.io", limit: 8 },
  { key: "Lever & Ashby", source: "Lever", site: "jobs.lever.co OR jobs.ashbyhq.com", limit: 8 },
  { key: "Y Combinator", source: "YC", site: "workatastartup.com/jobs OR ycombinator.com/jobs", limit: 6 },
  {
    key: "Remote boards",
    source: "Remote",
    site: "remoteok.com/remote-jobs OR weworkremotely.com/remote-jobs OR wellfound.com/jobs",
    limit: 8,
  },
];

function detectWorkMode(text: string): JobResult["workMode"] {
  const t = text.toLowerCase();
  if (/\bhybrid\b/.test(t)) return "Hybrid";
  if (/\bremote\b|work from home|wfh/.test(t)) return "Remote";
  if (/\bon-?site\b|in-office|in office/.test(t)) return "Onsite";
  return "Unspecified";
}

// Heuristic "Title - Company - Location" parse, used only as an AI fallback.
function parse(title: string, source: JobResult["source"], loc: string) {
  const cleaned = title.replace(/\s*[|·]\s*(LinkedIn|Indeed|Glassdoor|Greenhouse|Lever|Ashby|Wellfound).*/i, "").trim();
  const parts = cleaned
    .split(/\s+[-–—]\s+|\s+at\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  let jobTitle = cleaned;
  let company = "";
  let location = "";
  if (parts.length >= 3) {
    jobTitle = parts[0];
    company = parts[1];
    location = parts.slice(2).join(", ");
  } else if (parts.length === 2) {
    jobTitle = parts[0];
    company = parts[1];
  }
  if (!location) location = loc && loc !== "Anywhere" ? loc : "See listing";
  if (!company) company = source === "Remote" ? "Remote employer" : "See listing";
  return { jobTitle, company, location };
}

interface RawResult {
  url?: string;
  title?: string;
  description?: string;
}

function extractResults(res: unknown): RawResult[] {
  const r = res as { web?: RawResult[]; data?: RawResult[] } | RawResult[];
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.web)) return r.web;
  if (Array.isArray(r?.data)) return r.data;
  return [];
}

interface RawItem {
  source: JobResult["source"];
  url: string;
  title: string;
  description: string;
}

// URLs that are clearly not a single posting (search / category / list pages).
function looksLikeListingIndex(url: string): boolean {
  const u = url.toLowerCase();
  return (
    /\/jobs\/search|\/jobs\/?$|\/q-|\/careers\/?$|\/companies|\bsearch\b|\/browse\b|\?keywords=|\bindeed\.com\/jobs\b/.test(
      u,
    ) && !/\/view|\/viewjob|\/job\/|\/jobs\/[a-z0-9-]{6,}/.test(u)
  );
}

async function aiFilterAndExtract(
  raw: RawItem[],
  args: SearchArgs,
): Promise<JobResult[] | null> {
  const hasKey = !!(process.env.LOVABLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  if (!hasKey || raw.length === 0) return null;

  const numbered = raw
    .map(
      (r, i) =>
        `[${i}] source=${r.source} | url=${r.url}\n    title: ${r.title}\n    snippet: ${r.description || "(none)"}`,
    )
    .join("\n");

  const locLine = args.location && args.location !== "Anywhere" ? args.location : "any location";
  const modeLine = args.workMode !== "Any" ? args.workMode : "any work mode";

  const system: ChatMessage = {
    role: "system",
    content:
      "You are a precise job-listing verifier for a career platform. You are given raw web search results. " +
      "Return ONLY entries that are a SINGLE, REAL, CURRENTLY-OPEN job posting page for an individual role. " +
      "STRICTLY EXCLUDE: search result pages, category/browse pages, company landing pages, 'jobs in X' lists, " +
      "expired/closed postings, articles, and anything that is not one specific apply-able job. " +
      "Only keep rows that genuinely match the user's target role, location, and work mode. " +
      "Extract clean fields. Never invent a URL — refer to rows by their index only. " +
      'Respond with STRICT JSON only, no markdown: {"jobs":[{"i":<row index>,"title":"","company":"","location":"","workMode":"Remote|Onsite|Hybrid|Unspecified","postedText":"","confidence":<0-100>}]}. ' +
      "confidence = how sure you are this is a real, open, relevant posting. Drop anything below 65. Order best first.",
  };
  const user: ChatMessage = {
    role: "user",
    content:
      `Target role: "${args.query}"\nTarget location: ${locLine}\nWork mode: ${modeLine}\n\n` +
      `Raw results:\n${numbered}`,
  };

  try {
    const res = await callAI([system, user], { model: "google/gemini-2.5-flash" });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    const json = extractJson(content);
    if (!json) return null;
    const parsed = JSON.parse(json) as {
      jobs?: {
        i?: number;
        title?: string;
        company?: string;
        location?: string;
        workMode?: string;
        postedText?: string;
        confidence?: number;
      }[];
    };
    const out: JobResult[] = [];
    for (const j of parsed.jobs ?? []) {
      const idx = typeof j.i === "number" ? j.i : -1;
      const src = raw[idx];
      if (!src) continue;
      const conf = typeof j.confidence === "number" ? j.confidence : 70;
      if (conf < 65) continue;
      const mode = (["Remote", "Onsite", "Hybrid", "Unspecified"].includes(j.workMode ?? "")
        ? j.workMode
        : detectWorkMode(`${src.title} ${src.description}`)) as JobResult["workMode"];
      out.push({
        title: (j.title || src.title).trim(),
        company: (j.company || "See listing").trim(),
        location: (j.location || (args.location !== "Anywhere" ? args.location : "See listing")).trim(),
        source: src.source,
        workMode: mode,
        url: src.url,
        description: src.description,
        postedText: j.postedText?.trim() || undefined,
        confidence: conf,
      });
    }
    return out;
  } catch {
    return null;
  }
}

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return body.slice(start, end + 1);
}

export async function searchJobsOnPlatforms(args: SearchArgs): Promise<JobResult[]> {
  const fc = getClient();
  const tbs = tbsFor(args.timeframe);

  const activePlatforms = PLATFORMS.filter(
    (p) => !args.sources || args.sources.length === 0 || args.sources.includes(p.key),
  );

  const locPart = args.location && args.location !== "Anywhere" ? ` ${args.location}` : "";
  const modePart = args.workMode !== "Any" ? ` ${args.workMode}` : "";

  const searches = activePlatforms.map(async (platform) => {
    const q = `${args.query}${modePart} jobs${locPart} site:${platform.site}`;
    try {
      const res = await fc.search(q, {
        limit: platform.limit,
        tbs,
        scrapeOptions: undefined,
      } as Parameters<typeof fc.search>[1]);
      const raw = extractResults(res);
      return raw
        .map((item): RawItem | null => {
          if (!item.url) return null;
          if (looksLikeListingIndex(item.url)) return null;
          return {
            source: platform.source,
            url: item.url,
            title: item.title ?? "Job posting",
            description: (item.description ?? "").slice(0, 300),
          };
        })
        .filter((x): x is RawItem => x !== null);
    } catch {
      return [];
    }
  });

  const settled = await Promise.all(searches);
  let flat = settled.flat();

  // Dedupe by URL (ignoring query strings) before the AI pass.
  const seen = new Set<string>();
  flat = flat.filter((j) => {
    const key = j.url.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Primary path: AI verification + extraction (high precision).
  const aiJobs = await aiFilterAndExtract(flat, args);

  let jobs: JobResult[];
  if (aiJobs && aiJobs.length > 0) {
    jobs = aiJobs;
  } else {
    // Fallback: heuristic parse of every raw item.
    jobs = flat.map((r) => {
      const { jobTitle, company, location } = parse(r.title, r.source, args.location);
      return {
        title: jobTitle,
        company,
        location,
        source: r.source,
        workMode: detectWorkMode(`${r.title} ${r.description}`),
        url: r.url,
        description: r.description,
      } satisfies JobResult;
    });
  }

  // Respect an explicit work-mode filter when detectable.
  if (args.workMode !== "Any") {
    jobs = jobs.filter((j) => j.workMode === args.workMode || j.workMode === "Unspecified");
  }

  // Final dedupe + sort by confidence.
  const seen2 = new Set<string>();
  jobs = jobs.filter((j) => {
    const key = j.url.split("?")[0];
    if (seen2.has(key)) return false;
    seen2.add(key);
    return true;
  });
  jobs.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  return jobs;
}
