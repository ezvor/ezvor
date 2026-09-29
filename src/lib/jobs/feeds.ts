// Free, keyless job aggregators: Remotive, RemoteOK, Arbeitnow and the
// monthly Hacker News "Who is hiring?" thread (via the Algolia HN API).
//
// Attribution: Remotive and RemoteOK ask to be credited and linked. Every
// posting keeps its source badge and links straight to the source's URL.

import { cached, decodeEntities, fetchJSON, fixMojibake, htmlToText, snippet } from "./http";
import type { FeedJob, WorkModeValue } from "./types";

function modeFromText(text: string, remoteFlag?: boolean): WorkModeValue {
  const t = text.toLowerCase();
  if (/\bhybrid\b/.test(t)) return "Hybrid";
  if (remoteFlag || /\bremote\b|work from home|\bwfh\b|\banywhere\b/.test(t)) return "Remote";
  if (/\bon-?site\b|\bin[- ]office\b|\bonsite\b/.test(t)) return "Onsite";
  return "Unspecified";
}

function ts(v: string | number | undefined | null, unit: "ms" | "s" = "ms"): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return unit === "s" ? v * 1000 : v;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`);
  return Number.isFinite(t) ? t : undefined;
}

/* -------------------------------------------------------------- Remotive */

type RemotiveResp = {
  jobs?: {
    url?: string;
    title?: string;
    company_name?: string;
    category?: string;
    tags?: string[];
    job_type?: string;
    publication_date?: string;
    candidate_required_location?: string;
    salary?: string;
    description?: string;
  }[];
};

export function fetchRemotive(): Promise<FeedJob[]> {
  // The public API returns its current feed regardless of query, so fetch it
  // once and filter locally.
  return cached(
    "feed:remotive",
    async () => {
      const data = await fetchJSON<RemotiveResp>("https://remotive.com/api/remote-jobs?limit=200");
      return (data.jobs ?? [])
        .filter((j) => j.url && j.title)
        .map((j) => ({
          source: "Remotive" as const,
          title: decodeEntities(j.title!).trim(),
          company: j.company_name?.trim() || "Remote employer",
          location: j.candidate_required_location?.trim() || "Worldwide",
          workMode: "Remote" as const,
          url: j.url!,
          description: snippet(htmlToText(j.description ?? ""), 260),
          postedAt: ts(j.publication_date),
          salary: j.salary?.trim() || undefined,
          tags: [j.category ?? "", ...(j.tags ?? [])].filter(Boolean),
        }));
    },
    30 * 60_000,
  );
}

/* -------------------------------------------------------------- RemoteOK */

type RemoteOkItem = {
  id?: string;
  position?: string;
  company?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  epoch?: number;
  tags?: string[];
  description?: string;
  salary_min?: number;
  salary_max?: number;
};

export function fetchRemoteOK(): Promise<FeedJob[]> {
  return cached("feed:remoteok", async () => {
    const data = await fetchJSON<RemoteOkItem[]>("https://remoteok.com/api", {
      headers: { "user-agent": "Mozilla/5.0 (compatible; EzvorJobs/1.0; +https://remoteok.com)" },
    });
    if (!Array.isArray(data)) return [];
    return data
      .filter((j) => j.position && (j.url || j.apply_url))
      .map((j) => {
        const salary =
          j.salary_min && j.salary_max
            ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round(j.salary_max / 1000)}k`
            : undefined;
        return {
          source: "RemoteOK" as const,
          title: fixMojibake(decodeEntities(j.position!)).trim(),
          company: fixMojibake(j.company ?? "").trim() || "Remote employer",
          location: fixMojibake(j.location ?? "").trim() || "Worldwide",
          workMode: "Remote" as const,
          url: (j.url || j.apply_url)!.replace("remoteOK.com", "remoteok.com"),
          description: snippet(fixMojibake(htmlToText(j.description ?? "")), 260),
          postedAt: j.epoch ? j.epoch * 1000 : ts(j.date),
          salary,
          tags: j.tags ?? [],
        };
      });
  });
}

/* ------------------------------------------------------------- Arbeitnow */

type ArbeitnowResp = {
  data?: {
    slug?: string;
    company_name?: string;
    title?: string;
    description?: string;
    remote?: boolean;
    url?: string;
    tags?: string[];
    job_types?: string[];
    location?: string;
    created_at?: number;
  }[];
};

export function fetchArbeitnow(): Promise<FeedJob[]> {
  return cached("feed:arbeitnow", async () => {
    const data = await fetchJSON<ArbeitnowResp>("https://www.arbeitnow.com/api/job-board-api", {
      timeoutMs: 12_000,
    });
    return (data.data ?? [])
      .filter((j) => j.title && j.slug)
      .map((j) => {
        const location = j.location?.trim() || "Europe";
        return {
          source: "Arbeitnow" as const,
          title: j.title!.trim(),
          company: j.company_name?.trim() || "See listing",
          location,
          // Arbeitnow lists European roles; lets "Remote · Europe" region matching work.
          locations: ["Europe"],
          workMode: j.remote ? ("Remote" as const) : modeFromText(`${j.title} ${location}`),
          // `url` is sometimes the employer's homepage; /view/<slug> always
          // redirects to the posting itself.
          url: j.url?.includes("arbeitnow.com/")
            ? j.url
            : `https://www.arbeitnow.com/view/${j.slug}`,
          description: snippet(htmlToText(j.description ?? ""), 260),
          postedAt: ts(j.created_at, "s"),
          tags: [...(j.tags ?? []), ...(j.job_types ?? [])],
        };
      });
  });
}

/* ---------------------------------------------------- HN: Who is hiring? */

type AlgoliaSearch = { hits?: { objectID: string; title?: string; created_at?: string }[] };
type AlgoliaItem = {
  id: number;
  created_at?: string;
  author?: string | null;
  text?: string | null;
  children?: AlgoliaItem[];
};

const SEGMENT_NOISE =
  /^(full[- ]?time|part[- ]?time|contract(or)?|intern(ship)?s?|freelance|permanent|ft|pt|visa|\$|€|£|\d|https?:|www\.|equity)/i;
const LOCATIONISH =
  /\b(remote|onsite|on-site|hybrid|in[- ]office|anywhere|worldwide|global|usa?|uk|eu|europe|emea|apac|americas|canada|germany|india|pakistan|london|berlin|new york|nyc|san francisco|sf|bay area|seattle|austin|boston|toronto|amsterdam|paris|dubai|singapore|sydney|timezone|[a-z]+,\s*[a-z]{2}\b)/i;

/** Split the "Company | Role | Location | ..." header of an HN hiring post. */
export function parseHnHeader(header: string) {
  const parts = header
    .split(/\s+\|\s+|\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const company = (parts[0] ?? "")
    .replace(/\(?https?:\/\/\S+\)?/g, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  const rest = parts.slice(1);
  const locations = rest.filter(
    (p) => LOCATIONISH.test(p) && !SEGMENT_NOISE.test(p) && p.length < 80,
  );
  const roles = rest.filter(
    (p) => !locations.includes(p) && !SEGMENT_NOISE.test(p) && p.length >= 3 && p.length < 120,
  );
  return { company, roles, location: locations.join(" · ") };
}

async function latestHiringThreadId(): Promise<string | null> {
  const data = await fetchJSON<AlgoliaSearch>(
    "https://hn.algolia.com/api/v1/search_by_date?query=%22who%20is%20hiring%22&tags=story,author_whoishiring&hitsPerPage=6",
  );
  const hit = (data.hits ?? []).find((h) => /who is hiring\?/i.test(h.title ?? ""));
  return hit?.objectID ?? null;
}

export function fetchHackerNews(): Promise<FeedJob[]> {
  return cached(
    "feed:hn",
    async () => {
      const id = await latestHiringThreadId();
      if (!id) return [];
      const thread = await fetchJSON<AlgoliaItem>(`https://hn.algolia.com/api/v1/items/${id}`, {
        timeoutMs: 15_000,
      });
      const out: FeedJob[] = [];
      for (const c of thread.children ?? []) {
        if (!c.text || !c.author) continue;
        const text = htmlToText(c.text);
        const [firstLine, ...body] = text.split("\n");
        if (!firstLine || !firstLine.includes("|")) continue;
        const { company, roles, location } = parseHnHeader(firstLine);
        if (!company) continue;
        out.push({
          source: "Hacker News",
          title: roles.slice(0, 2).join(" / ") || "Multiple roles",
          company,
          location: location || "See post",
          workMode: modeFromText(firstLine),
          url: `https://news.ycombinator.com/item?id=${c.id}`,
          description: snippet(body.join(" "), 280),
          postedAt: ts(c.created_at),
          header: firstLine,
        });
      }
      return out;
    },
    60 * 60_000,
  );
}
