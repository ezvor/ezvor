// Server-only job search. Everything here is free and keyless.
//
//   1. Structured feeds (src/lib/jobs): the public Greenhouse / Lever / Ashby
//      boards of ~55 well-known tech companies, Remotive, RemoteOK, Arbeitnow
//      and the monthly Hacker News "Who is hiring?" thread. Responses are
//      cached ~15 min per instance; keyword, location, work-mode and timeframe
//      filtering happens locally.
//   2. Web search (DuckDuckGo, or Tavily / Brave / Firecrawl when a key is set)
//      scoped to LinkedIn, Indeed, Glassdoor, Y Combinator and remote boards.
//      These hits are noisy, so an optional AI pass keeps only real, open,
//      relevant single postings (it answers with row indexes, so URLs can never
//      be invented). When AI is unavailable a heuristic parser takes over.
//   3. Merge, dedupe (URL + company/title), rank by relevance + recency, and
//      cap per company so one big employer can't flood the page.

import { aiJSON, type ChatMessage } from "./ai.server";
import { parseQuery, searchFeeds, titleMatches, wants, type FeedReport } from "./jobs";
import { withDeadline } from "./jobs/http";
import type { JobResult, JobSearchArgs, JobSource, WorkModeValue } from "./jobs/types";
import { webSearch, type Freshness } from "./web.server";

export type { JobResult, JobSource } from "./jobs/types";

export interface SourceReport {
  name: string;
  count: number;
  ok: boolean;
}

export interface JobSearchOutcome {
  jobs: JobResult[];
  sources: SourceReport[];
  /** True when the AI precision pass ran over the web results. */
  aiFiltered: boolean;
}

const MAX_RESULTS = 60;
const PER_COMPANY = 5;

function freshnessFor(t: JobSearchArgs["timeframe"]): Freshness {
  switch (t) {
    case "Past 24 hours":
      return "day";
    case "Past 3 days":
    case "Past week":
      return "week";
    case "Past month":
      return "month";
    default:
      return undefined;
  }
}

/* ------------------------------------------------------------ web search */

const WEB_TARGETS: {
  key: "LinkedIn" | "Indeed" | "Glassdoor" | "Y Combinator" | "Remote boards";
  sites: string[];
  limit: number;
}[] = [
  { key: "LinkedIn", sites: ["linkedin.com/jobs/view"], limit: 10 },
  { key: "Indeed", sites: ["indeed.com/viewjob", "indeed.com/rc"], limit: 8 },
  { key: "Glassdoor", sites: ["glassdoor.com/job-listing"], limit: 6 },
  {
    key: "Y Combinator",
    sites: ["workatastartup.com/jobs", "ycombinator.com/companies"],
    limit: 6,
  },
  {
    key: "Remote boards",
    sites: ["weworkremotely.com/remote-jobs", "wellfound.com/jobs"],
    limit: 6,
  },
];

function sourceFromUrl(url: string): JobSource {
  const u = url.toLowerCase();
  if (u.includes("linkedin.com")) return "LinkedIn";
  if (u.includes("indeed.")) return "Indeed";
  if (u.includes("glassdoor.")) return "Glassdoor";
  if (u.includes("greenhouse.io")) return "Greenhouse";
  if (u.includes("lever.co")) return "Lever";
  if (u.includes("ashbyhq.com")) return "Ashby";
  if (u.includes("workatastartup.com") || u.includes("ycombinator.com")) return "YC";
  if (u.includes("remoteok.com")) return "RemoteOK";
  if (u.includes("remotive.com")) return "Remotive";
  if (/weworkremotely|wellfound|remote/.test(u)) return "Remote";
  return "Web";
}

function detectWorkMode(text: string): WorkModeValue {
  const t = text.toLowerCase();
  if (/\bhybrid\b/.test(t)) return "Hybrid";
  if (/\bremote\b|work from home|\bwfh\b/.test(t)) return "Remote";
  if (/\bon-?site\b|in-office|in office/.test(t)) return "Onsite";
  return "Unspecified";
}

interface RawItem {
  source: JobSource;
  url: string;
  title: string;
  description: string;
}

/** URLs that are clearly not a single posting (search / category / list pages). */
function looksLikeListingIndex(url: string): boolean {
  const u = url.toLowerCase();
  return (
    /\/jobs\/search|\/jobs\/?$|\/q-|\/careers\/?$|\/companies\/?$|\bsearch\b|\/browse\b|\?keywords=|\bindeed\.com\/jobs\b|\/jobs-in-|\/remote-jobs\/?$/.test(
      u,
    ) && !/\/view|\/viewjob|\/job\/|\/jobs\/[a-z0-9-]{6,}|\/remote-jobs\/[a-z0-9-]{8,}/.test(u)
  );
}

/** Heuristic "Title - Company - Location" parse, used when AI is unavailable. */
function parseTitle(title: string, source: JobSource, loc: string) {
  const cleaned = title
    .replace(
      /\s*[|·]\s*(LinkedIn|Indeed|Glassdoor|Greenhouse|Lever|Ashby|Wellfound|We Work Remotely|Y Combinator).*/i,
      "",
    )
    .replace(/^(job application for|apply for)\s+/i, "")
    .trim();
  const hiring = /^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+(.+?))?$/i.exec(cleaned);
  if (hiring) {
    return { jobTitle: hiring[2], company: hiring[1], location: hiring[3] || fallbackLoc(loc) };
  }
  const parts = cleaned
    .split(/\s+[-–—]\s+|\s+at\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  let jobTitle = cleaned;
  let company = "";
  let location = "";
  if (parts.length >= 3) {
    [jobTitle, company] = parts;
    location = parts.slice(2).join(", ");
  } else if (parts.length === 2) {
    [jobTitle, company] = parts;
  }
  return {
    jobTitle,
    company: company || (source === "Remote" ? "Remote employer" : "See listing"),
    location: location || fallbackLoc(loc),
  };
}

function fallbackLoc(loc: string) {
  return loc && loc !== "Anywhere" ? loc : "See listing";
}

async function webJobs(
  args: JobSearchArgs,
): Promise<{ items: RawItem[]; reports: SourceReport[] }> {
  const freshness = freshnessFor(args.timeframe);
  const locPart = args.location && args.location !== "Anywhere" ? ` ${args.location}` : "";
  const modePart = args.workMode !== "Any" ? ` ${args.workMode}` : "";
  const targets = WEB_TARGETS.filter((t) => wants(args, t.key));

  const settled = await Promise.all(
    targets.map(async (t) => {
      const siteExpr =
        t.sites.length === 1
          ? `site:${t.sites[0]}`
          : `(${t.sites.map((s) => `site:${s}`).join(" OR ")})`;
      const q = `${args.query}${modePart}${locPart} ${siteExpr}`;
      const hits = await webSearch(q, { limit: t.limit, freshness }).catch(() => []);
      const items = hits
        .filter((h) => h.url && /^https?:\/\//.test(h.url) && !looksLikeListingIndex(h.url))
        .map((h): RawItem => ({
          source: sourceFromUrl(h.url),
          url: h.url,
          title: h.title || "Job posting",
          description: (h.description ?? "").slice(0, 300),
        }));
      return { key: t.key, items };
    }),
  );
  return {
    items: settled.flatMap((s) => s.items),
    reports: settled.map((s) => ({
      name: `${s.key} (web)`,
      count: s.items.length,
      ok: s.items.length > 0,
    })),
  };
}

type AiRow = {
  i: number;
  title?: string;
  company?: string;
  location?: string;
  workMode?: string;
  postedText?: string;
  confidence?: number;
};

/** Optional precision pass over noisy web hits. Returns null when AI is unavailable. */
async function aiFilter(raw: RawItem[], args: JobSearchArgs): Promise<JobResult[] | null> {
  if (raw.length < 4) return null;
  const rows = raw.slice(0, 36);
  const numbered = rows
    .map(
      (r, i) =>
        `[${i}] ${r.source} | ${r.url}\n    title: ${r.title}\n    snippet: ${r.description || "(none)"}`,
    )
    .join("\n");
  const locLine = args.location && args.location !== "Anywhere" ? args.location : "any location";
  const modeLine = args.workMode !== "Any" ? args.workMode : "any work mode";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You verify raw job search results. Keep ONLY rows that are a single, real, currently-open job posting for one role " +
        "that matches the target role, location and work mode. Drop search pages, category or company pages, 'jobs in X' lists, " +
        "articles and expired postings. Refer to rows by index only; never invent URLs. " +
        "confidence = 0-100 certainty the row is a real, open, relevant posting.",
    },
    {
      role: "user",
      content: `Target role: "${args.query}"\nLocation: ${locLine}\nWork mode: ${modeLine}\n\nRows:\n${numbered}`,
    },
  ];

  try {
    const out = await aiJSON<{ jobs?: AiRow[] }>(
      messages,
      {
        name: "verified_jobs",
        description: "The rows that are real, open, relevant single job postings.",
        parameters: {
          type: "object",
          properties: {
            jobs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  i: { type: "integer", description: "Row index" },
                  title: { type: "string" },
                  company: { type: "string" },
                  location: { type: "string" },
                  workMode: { type: "string", enum: ["Remote", "Onsite", "Hybrid", "Unspecified"] },
                  postedText: { type: "string", description: "e.g. '3 days ago', or empty" },
                  confidence: { type: "integer" },
                },
                required: ["i", "title", "company", "confidence"],
              },
            },
          },
          required: ["jobs"],
        },
      },
      { tier: "fast", timeoutMs: 25_000 },
    );
    if (!Array.isArray(out.jobs)) return null;
    const results: JobResult[] = [];
    const used = new Set<number>();
    for (const j of out.jobs) {
      const idx = Number(j.i);
      const src = rows[idx];
      if (!src || used.has(idx)) continue;
      used.add(idx);
      const conf = typeof j.confidence === "number" ? Math.max(0, Math.min(100, j.confidence)) : 70;
      if (conf < 65) continue;
      const mode = (["Remote", "Onsite", "Hybrid", "Unspecified"] as const).find(
        (m) => m === j.workMode,
      );
      results.push({
        title: (j.title || src.title).trim().slice(0, 160),
        company: (j.company || "See listing").trim().slice(0, 80),
        location: (j.location || fallbackLoc(args.location)).trim().slice(0, 80),
        source: src.source,
        workMode: mode ?? detectWorkMode(`${src.title} ${src.description}`),
        url: src.url,
        description: src.description,
        postedText: j.postedText?.trim() || undefined,
        confidence: conf,
      });
    }
    // A model that rejects everything on a big list is more likely broken than right.
    if (results.length === 0 && rows.length >= 10) return null;
    return results;
  } catch {
    return null;
  }
}

function heuristicWeb(raw: RawItem[], args: JobSearchArgs): JobResult[] {
  const q = parseQuery(args.query);
  return raw
    .map((r) => {
      const { jobTitle, company, location } = parseTitle(r.title, r.source, args.location);
      return {
        title: jobTitle,
        company,
        location,
        source: r.source,
        workMode: detectWorkMode(`${r.title} ${r.description}`),
        url: r.url,
        description: r.description,
        confidence: 55,
      } satisfies JobResult;
    })
    .filter((j) => titleMatches(j.title, q));
}

/* ----------------------------------------------------------------- merge */

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    const keep = ["gh_jid", "jk", "id", "currentJobId"];
    const params = keep
      .map((k) => (u.searchParams.get(k) ? `${k}=${u.searchParams.get(k)}` : ""))
      .filter(Boolean)
      .join("&");
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}?${params}`.toLowerCase();
  } catch {
    return url.split("?")[0].toLowerCase();
  }
}

function roleKey(j: JobResult): string {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${n(j.company)}|${n(j.title)}|${n(j.location).slice(0, 12)}`;
}

function rank(jobs: JobResult[]): JobResult[] {
  const seenUrl = new Set<string>();
  const seenRole = new Set<string>();
  const unique: JobResult[] = [];
  // Direct postings first so they win dedupe against scraped copies.
  const ordered = [...jobs].sort((a, b) => Number(!!b.direct) - Number(!!a.direct));
  for (const j of ordered) {
    const u = urlKey(j.url);
    const r = roleKey(j);
    if (seenUrl.has(u) || (j.company !== "See listing" && seenRole.has(r))) continue;
    seenUrl.add(u);
    seenRole.add(r);
    unique.push(j);
  }

  const recency = (j: JobResult) => (j.postedAt ? Date.parse(j.postedAt) : 0);
  unique.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0) || recency(b) - recency(a));

  // Diversity: small penalties per extra posting from the same company / source,
  // then a hard per-company cap.
  const perCompany = new Map<string, number>();
  const perSource = new Map<string, number>();
  const adjusted = unique.map((j) => {
    const key = j.company.toLowerCase();
    const n = perCompany.get(key) ?? 0;
    const s = perSource.get(j.source) ?? 0;
    perCompany.set(key, n + 1);
    perSource.set(j.source, s + 1);
    const generic = key === "see listing" || key === "remote employer";
    return { j, n, score: (j.confidence ?? 0) - (generic ? 0 : n * 4) - Math.max(0, s - 2) * 0.75 };
  });
  return adjusted
    .filter((a) => a.n < PER_COMPANY || a.j.company === "See listing")
    .sort((a, b) => b.score - a.score || recency(b.j) - recency(a.j))
    .slice(0, MAX_RESULTS)
    .map((a) => a.j);
}

const WEB_DEADLINE_MS = 15_000;
const AI_DEADLINE_MS = 12_000;

export async function searchJobsOnPlatforms(args: JobSearchArgs): Promise<JobSearchOutcome> {
  const query = parseQuery(args.query);
  const noWeb = {
    items: [] as RawItem[],
    reports: WEB_TARGETS.filter((t) => wants(args, t.key)).map((t) => ({
      name: `${t.key} (web)`,
      count: 0,
      ok: false,
    })),
  };
  const [feeds, web] = await Promise.all([
    searchFeeds(args, { query, deadlineMs: 13_000 }),
    withDeadline(webJobs(args), WEB_DEADLINE_MS, noWeb),
  ]);

  // Web hits: AI precision pass when there are enough to be worth it, else heuristics.
  const aiJobs = await withDeadline(aiFilter(web.items, args), AI_DEADLINE_MS, null);
  let webResults = aiJobs ?? heuristicWeb(web.items, args);
  if (args.workMode !== "Any") {
    webResults = webResults.filter(
      (j) => j.workMode === args.workMode || j.workMode === "Unspecified",
    );
  }

  const jobs = rank([...feeds.jobs, ...webResults]);
  const sources: SourceReport[] = [
    ...feeds.reports.map((r: FeedReport) => ({ name: r.name, count: r.matched, ok: r.ok })),
    ...web.reports,
  ];
  return { jobs, sources, aiFiltered: !!aiJobs };
}
