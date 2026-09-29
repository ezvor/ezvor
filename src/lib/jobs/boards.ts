// Public ATS job boards of well-known tech companies.
//
// Greenhouse, Lever and Ashby expose every company's open roles as free,
// keyless JSON. Each token below was verified to respond with live postings
// (Sept 2026); a board that starts failing is skipped silently and retried
// after the cache's failure backoff.

import { cached, fetchJSON, htmlToText, snippet } from "./http";
import type { FeedJob, WorkModeValue } from "./types";

type Ats = "greenhouse" | "lever" | "ashby";

export interface CompanyBoard {
  name: string;
  ats: Ats;
  token: string;
}

export const COMPANY_BOARDS: CompanyBoard[] = [
  // Greenhouse
  { name: "Stripe", ats: "greenhouse", token: "stripe" },
  { name: "Airbnb", ats: "greenhouse", token: "airbnb" },
  { name: "Figma", ats: "greenhouse", token: "figma" },
  { name: "Discord", ats: "greenhouse", token: "discord" },
  { name: "Dropbox", ats: "greenhouse", token: "dropbox" },
  { name: "Reddit", ats: "greenhouse", token: "reddit" },
  { name: "Robinhood", ats: "greenhouse", token: "robinhood" },
  { name: "Coinbase", ats: "greenhouse", token: "coinbase" },
  { name: "Databricks", ats: "greenhouse", token: "databricks" },
  { name: "Datadog", ats: "greenhouse", token: "datadog" },
  { name: "GitLab", ats: "greenhouse", token: "gitlab" },
  { name: "Twilio", ats: "greenhouse", token: "twilio" },
  { name: "Pinterest", ats: "greenhouse", token: "pinterest" },
  { name: "Lyft", ats: "greenhouse", token: "lyft" },
  { name: "Instacart", ats: "greenhouse", token: "instacart" },
  { name: "Anthropic", ats: "greenhouse", token: "anthropic" },
  { name: "Samsara", ats: "greenhouse", token: "samsara" },
  { name: "Elastic", ats: "greenhouse", token: "elastic" },
  { name: "Okta", ats: "greenhouse", token: "okta" },
  { name: "Duolingo", ats: "greenhouse", token: "duolingo" },
  { name: "Vercel", ats: "greenhouse", token: "vercel" },
  { name: "Scale AI", ats: "greenhouse", token: "scaleai" },
  { name: "Waymo", ats: "greenhouse", token: "waymo" },
  { name: "Roblox", ats: "greenhouse", token: "roblox" },
  { name: "Intercom", ats: "greenhouse", token: "intercom" },
  { name: "Monzo", ats: "greenhouse", token: "monzo" },
  { name: "Motive", ats: "greenhouse", token: "gomotive" },
  { name: "Careem", ats: "greenhouse", token: "careem" },
  { name: "Canonical", ats: "greenhouse", token: "canonical" },
  { name: "Remote", ats: "greenhouse", token: "remotecom" },
  { name: "Grafana Labs", ats: "greenhouse", token: "grafanalabs" },
  { name: "Tailscale", ats: "greenhouse", token: "tailscale" },
  { name: "Turing", ats: "greenhouse", token: "turing" },
  { name: "Automattic", ats: "greenhouse", token: "automatticcareers" },
  { name: "Mozilla", ats: "greenhouse", token: "mozilla" },
  { name: "HackerRank", ats: "greenhouse", token: "hackerrank" },
  // Lever
  { name: "Palantir", ats: "lever", token: "palantir" },
  { name: "Spotify", ats: "lever", token: "spotify" },
  { name: "Zoox", ats: "lever", token: "zoox" },
  { name: "Toptal", ats: "lever", token: "toptal" },
  // Ashby
  { name: "OpenAI", ats: "ashby", token: "openai" },
  { name: "Notion", ats: "ashby", token: "notion" },
  { name: "Linear", ats: "ashby", token: "linear" },
  { name: "Ramp", ats: "ashby", token: "ramp" },
  { name: "Supabase", ats: "ashby", token: "supabase" },
  { name: "PostHog", ats: "ashby", token: "posthog" },
  { name: "Replit", ats: "ashby", token: "replit" },
  { name: "Cohere", ats: "ashby", token: "cohere" },
  { name: "Perplexity", ats: "ashby", token: "perplexity" },
  { name: "Cursor", ats: "ashby", token: "cursor" },
  { name: "ElevenLabs", ats: "ashby", token: "elevenlabs" },
  { name: "Docker", ats: "ashby", token: "docker" },
  { name: "Plaid", ats: "ashby", token: "plaid" },
  { name: "1Password", ats: "ashby", token: "1password" },
  { name: "ClickHouse", ats: "ashby", token: "clickhouse" },
  { name: "Zapier", ats: "ashby", token: "zapier" },
];

function modeFrom(raw: string | undefined | null, locationText: string): WorkModeValue {
  const v = (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (v === "remote") return "Remote";
  if (v === "hybrid") return "Hybrid";
  if (v === "onsite" || v === "inoffice") return "Onsite";
  const loc = locationText.toLowerCase();
  if (/\bhybrid\b/.test(loc)) return "Hybrid";
  if (/\bremote\b|\banywhere\b/.test(loc)) return "Remote";
  if (/\bon-?site\b|\bin[- ]office\b/.test(loc)) return "Onsite";
  return "Unspecified";
}

function time(v: string | number | undefined | null): number | undefined {
  if (v == null || v === "") return undefined;
  const t = typeof v === "number" ? v : Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}

/* ------------------------------------------------------------ Greenhouse */

type GreenhouseResp = {
  jobs?: {
    title?: string;
    absolute_url?: string;
    location?: { name?: string };
    updated_at?: string;
    first_published?: string;
    company_name?: string;
  }[];
};

async function greenhouse(board: CompanyBoard): Promise<FeedJob[]> {
  const data = await fetchJSON<GreenhouseResp>(
    `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs`,
  );
  return (data.jobs ?? [])
    .filter((j) => j.title && j.absolute_url)
    .map((j) => {
      const location = j.location?.name?.trim() || "See listing";
      return {
        source: "Greenhouse" as const,
        title: j.title!.trim(),
        company: board.name,
        location,
        workMode: modeFrom(null, location),
        url: j.absolute_url!,
        description: `Posted on ${board.name}'s official careers board.`,
        postedAt: time(j.first_published) ?? time(j.updated_at),
      };
    });
}

/* ----------------------------------------------------------------- Lever */

type LeverPosting = {
  text?: string;
  hostedUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  country?: string;
  descriptionPlain?: string;
  openingPlain?: string;
  categories?: {
    location?: string;
    allLocations?: string[];
    commitment?: string;
    team?: string;
    department?: string;
  };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

async function lever(board: CompanyBoard): Promise<FeedJob[]> {
  const data = await fetchJSON<LeverPosting[]>(
    `https://api.lever.co/v0/postings/${board.token}?mode=json`,
  );
  if (!Array.isArray(data)) return [];
  return data
    .filter((j) => j.text && j.hostedUrl)
    .map((j) => {
      const location = j.categories?.location?.trim() || "See listing";
      const team = [j.categories?.department, j.categories?.team].filter(Boolean).join(" · ");
      const body = snippet(j.openingPlain || j.descriptionPlain || "", 260);
      return {
        source: "Lever" as const,
        title: j.text!.trim(),
        company: board.name,
        location,
        locations: [...(j.categories?.allLocations ?? []), j.country ?? ""].filter(Boolean),
        moreLocations: (j.categories?.allLocations ?? []).filter((l) => l !== location).length,
        workMode: modeFrom(j.workplaceType, location),
        url: j.hostedUrl!,
        description: [team, body].filter(Boolean).join(" — "),
        postedAt: time(j.createdAt),
        salary: salaryText(j.salaryRange),
        tags: [j.categories?.team, j.categories?.department, j.categories?.commitment].filter(
          (t): t is string => !!t,
        ),
      };
    });
}

function salaryText(r?: LeverPosting["salaryRange"]): string | undefined {
  if (!r?.min || !r.max) return undefined;
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  return `${r.currency ?? ""} ${fmt(r.min)}–${fmt(r.max)}${r.interval ? ` / ${r.interval.replace(/-/g, " ")}` : ""}`.trim();
}

/* ----------------------------------------------------------------- Ashby */

type AshbyResp = {
  jobs?: {
    title?: string;
    jobUrl?: string;
    location?: string;
    secondaryLocations?: { location?: string }[];
    isRemote?: boolean;
    workplaceType?: string;
    publishedAt?: string;
    isListed?: boolean;
    department?: string;
    team?: string;
    employmentType?: string;
    descriptionPlain?: string;
    descriptionHtml?: string;
    address?: { postalAddress?: { addressCountry?: string; addressLocality?: string } };
  }[];
};

async function ashby(board: CompanyBoard): Promise<FeedJob[]> {
  const data = await fetchJSON<AshbyResp>(
    `https://api.ashbyhq.com/posting-api/job-board/${board.token}?includeCompensation=false`,
    { timeoutMs: 12_000 },
  );
  return (data.jobs ?? [])
    .filter((j) => j.title && j.jobUrl && j.isListed !== false)
    .map((j) => {
      const location = j.location?.trim() || "See listing";
      const team = [j.department, j.team].filter(Boolean).join(" · ");
      const plain = j.descriptionPlain || (j.descriptionHtml ? htmlToText(j.descriptionHtml) : "");
      const mode: WorkModeValue = j.workplaceType
        ? modeFrom(j.workplaceType, location)
        : j.isRemote
          ? "Remote"
          : modeFrom(null, location);
      return {
        source: "Ashby" as const,
        title: j.title!.trim(),
        company: board.name,
        location,
        locations: [
          ...(j.secondaryLocations ?? []).map((s) => s.location ?? ""),
          j.address?.postalAddress?.addressCountry ?? "",
        ].filter(Boolean),
        moreLocations: (j.secondaryLocations ?? []).filter((s) => s.location).length,
        workMode: mode === "Unspecified" && j.isRemote ? "Remote" : mode,
        url: j.jobUrl!,
        description: [team, snippet(plain, 240)].filter(Boolean).join(" — "),
        postedAt: time(j.publishedAt),
        tags: [j.department, j.team, j.employmentType].filter((t): t is string => !!t),
      };
    });
}

const LOADERS: Record<Ats, (b: CompanyBoard) => Promise<FeedJob[]>> = {
  greenhouse,
  lever,
  ashby,
};

/** One company's open roles (cached ~15 min). Never throws. */
export async function fetchBoard(board: CompanyBoard): Promise<FeedJob[]> {
  try {
    return await cached(`board:${board.ats}:${board.token}`, () => LOADERS[board.ats](board));
  } catch {
    return [];
  }
}

/** Every curated company board, fetched in parallel. Never throws. */
export async function fetchAllBoards(): Promise<FeedJob[]> {
  const all = await Promise.all(COMPANY_BOARDS.map(fetchBoard));
  return all.flat();
}
