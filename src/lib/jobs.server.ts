// Server-only job search across LinkedIn, Indeed, Glassdoor and remote boards.
// Uses Firecrawl web search with time filters, then normalizes + dedupes.
import Firecrawl from "@mendable/firecrawl-js";

export interface JobResult {
  title: string;
  company: string;
  location: string;
  source: "LinkedIn" | "Indeed" | "Glassdoor" | "Remote";
  workMode: "Remote" | "Onsite" | "Hybrid" | "Unspecified";
  url: string;
  description: string;
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

const PLATFORMS: { key: string; source: JobResult["source"]; site: string }[] = [
  { key: "LinkedIn", source: "LinkedIn", site: "linkedin.com/jobs" },
  { key: "Indeed", source: "Indeed", site: "indeed.com" },
  { key: "Glassdoor", source: "Glassdoor", site: "glassdoor.com" },
  { key: "Remote boards", source: "Remote", site: "remoteok.com OR weworkremotely.com OR wellfound.com" },
];

function detectWorkMode(text: string): JobResult["workMode"] {
  const t = text.toLowerCase();
  if (/\bhybrid\b/.test(t)) return "Hybrid";
  if (/\bremote\b|work from home|wfh/.test(t)) return "Remote";
  if (/\bon-?site\b|in-office|in office/.test(t)) return "Onsite";
  return "Unspecified";
}

// Best-effort parse of "Title - Company - Location" style search titles.
function parse(title: string, description: string, source: JobResult["source"], loc: string) {
  const cleaned = title.replace(/\s*\|\s*(LinkedIn|Indeed|Glassdoor).*/i, "").trim();
  const parts = cleaned.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
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
        limit: 8,
        tbs,
        scrapeOptions: undefined,
      } as Parameters<typeof fc.search>[1]);
      const raw = extractResults(res);
      return raw.map((item): JobResult | null => {
        if (!item.url) return null;
        const title = item.title ?? "Job posting";
        const description = (item.description ?? "").slice(0, 260);
        const { jobTitle, company, location } = parse(title, description, platform.source, args.location);
        return {
          title: jobTitle,
          company,
          location,
          source: platform.source,
          workMode: detectWorkMode(`${title} ${description}`),
          url: item.url,
          description,
        };
      });
    } catch {
      return [];
    }
  });

  const settled = await Promise.all(searches);
  const flat = settled.flat().filter((j): j is JobResult => j !== null);

  // Filter by requested work mode when it was detectable.
  const modeFiltered =
    args.workMode === "Any"
      ? flat
      : flat.filter((j) => j.workMode === args.workMode || j.workMode === "Unspecified");

  // Dedupe by URL.
  const seen = new Set<string>();
  const unique = modeFiltered.filter((j) => {
    const key = j.url.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}
