// Local query matching + ranking for structured job feeds.
//
// Feeds return every open role, so relevance is decided here: role keywords
// must appear in the title (seniority words are soft preferences), the
// location must match the chosen country / city aliases (or be a worldwide
// remote role), and recency adds a boost.

import type { FeedJob, JobSearchArgs, Timeframe, WorkModeValue } from "./types";

/* ------------------------------------------------------------ normalise */

const PHRASES: [RegExp, string][] = [
  [/c\+\+/g, " cpp "],
  [/c#/g, " csharp "],
  [/\.net\b/g, " dotnet "],
  [/node\.?js/g, " node "],
  [/react\.?js/g, " react "],
  [/vue\.?js/g, " vue "],
  [/next\.?js/g, " nextjs "],
  [/\bfront[\s-]?end\b/g, " frontend "],
  [/\bback[\s-]?end\b/g, " backend "],
  [/\bfull[\s-]?stack\b/g, " fullstack "],
  [/\bmachine learning\b/g, " ml "],
  [/\bartificial intelligence\b/g, " ai "],
  [/\bsite reliability\b/g, " sre "],
  [/\bquality assurance\b|\bsqa\b/g, " qa "],
  [/\bdev[\s-]?ops\b/g, " devops "],
  [/\bsoftware development engineer\b|\bsde\b|\bswe\b/g, " software engineer "],
  [/\bentry[\s-]level\b/g, " entry "],
  [/\bnew grad(uate)?\b/g, " graduate "],
  [/\bmid[\s-]level\b/g, " mid "],
  [/\bui\s*\/\s*ux\b/g, " ui ux "],
];

/** Words that share a meaning for matching purposes. */
const CANON: Record<string, string> = {
  engineers: "engineer",
  engineering: "engineer",
  developer: "engineer",
  developers: "engineer",
  programmer: "engineer",
  dev: "engineer",
  internship: "intern",
  internships: "intern",
  interns: "intern",
  jr: "junior",
  sr: "senior",
  scientists: "scientist",
  analysts: "analyst",
  designers: "designer",
  design: "designer",
  managers: "manager",
  management: "manager",
  administrator: "admin",
  mobile: "mobile",
  golang: "go",
  js: "javascript",
  ts: "typescript",
  k8s: "kubernetes",
  ios: "ios",
};

const STOP = new Set([
  "job",
  "jobs",
  "role",
  "roles",
  "position",
  "positions",
  "opening",
  "openings",
  "hiring",
  "vacancy",
  "vacancies",
  "career",
  "careers",
  "in",
  "at",
  "for",
  "and",
  "or",
  "the",
  "a",
  "an",
  "of",
  "to",
  "with",
  "remote",
  "onsite",
  "hybrid",
  "full",
  "time",
  "part",
  "fulltime",
  "parttime",
  "work",
  "from",
  "home",
]);

const SENIORITY = new Set([
  "intern",
  "junior",
  "associate",
  "entry",
  "graduate",
  "trainee",
  "apprentice",
  "mid",
  "senior",
  "staff",
  "principal",
  "lead",
]);
const JUNIOR = new Set([
  "intern",
  "junior",
  "associate",
  "entry",
  "graduate",
  "trainee",
  "apprentice",
]);
const SENIOR_TITLE =
  /\b(senior|sr|staff|principal|lead|head|director|vp|vice president|chief|distinguished|architect|manager)\b/;
const LEADERSHIP_TITLE = /\b(manager|director|head|vp|vice president|chief)\b/;

export function normalise(s: string): string {
  let t = ` ${s.toLowerCase()} `;
  for (const [re, rep] of PHRASES) t = t.replace(re, rep);
  return t
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canon(word: string): string {
  const w = CANON[word] ?? word;
  if (CANON[w]) return CANON[w];
  // Light plural stemming ("analysts", "apis").
  if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss"))
    return CANON[w.slice(0, -1)] ?? w.slice(0, -1);
  return w;
}

export function tokenSet(s: string): Set<string> {
  return new Set(normalise(s).split(" ").filter(Boolean).map(canon));
}

export interface ParsedQuery {
  phrase: string;
  core: string[];
  seniority: string[];
}

export function parseQuery(q: string): ParsedQuery {
  const words = normalise(q)
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map(canon);
  const uniq = [...new Set(words)];
  const seniority = uniq.filter((w) => SENIORITY.has(w));
  let core = uniq.filter((w) => !SENIORITY.has(w));
  // A query made only of seniority words ("intern") still has to match something.
  if (!core.length) core = seniority.slice();
  return { phrase: normalise(q), core, seniority };
}

/* ------------------------------------------------------------ locations */

const US_STATES =
  /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
const CA_PROVINCES = /,\s*(ON|BC|QC|AB|MB|NS|NB|SK|NL|PE)\b/;

const LOCATION_ALIASES: Record<string, { words: RegExp; regions: RegExp; codes?: RegExp }> = {
  Pakistan: {
    words:
      /\b(pakistan|lahore|karachi|islamabad|rawalpindi|faisalabad|peshawar|multan|quetta|sialkot)\b/,
    regions: /\b(apac|asia|south asia|mena|middle east|emea)\b/,
  },
  "United States": {
    words:
      /\b(united states|usa|us|u s|new york|nyc|san francisco|sf|bay area|seattle|austin|boston|chicago|los angeles|denver|atlanta|miami|washington|palo alto|mountain view|menlo park|sunnyvale|san jose|san diego|san mateo|redmond|portland|philadelphia|dallas|houston|pittsburgh|phoenix|salt lake|nashville|raleigh|detroit|minneapolis|brooklyn|california|texas|florida|colorado|massachusetts|illinois|georgia|virginia|oregon|arizona)\b/,
    regions: /\b(americas|north america|us timezones?|est|pst|cst)\b/,
    codes: US_STATES,
  },
  "United Kingdom": {
    words:
      /\b(united kingdom|uk|u k|england|scotland|wales|great britain|britain|gb|london|manchester|edinburgh|glasgow|cambridge|oxford|bristol|belfast|leeds|birmingham)\b/,
    regions: /\b(europe|emea|eu|european)\b/,
  },
  Canada: {
    words:
      /\b(canada|toronto|vancouver|montreal|ottawa|calgary|waterloo|edmonton|winnipeg|quebec)\b/,
    regions: /\b(americas|north america)\b/,
    codes: CA_PROVINCES,
  },
  Germany: {
    words:
      /\b(germany|deutschland|berlin|munich|munchen|muenchen|hamburg|frankfurt|cologne|koln|stuttgart|dusseldorf|leipzig|dresden|karlsruhe|nuremberg|nurnberg|bonn|hannover|heidelberg)\b/,
    regions: /\b(europe|emea|eu|european|dach)\b/,
  },
  "United Arab Emirates": {
    words: /\b(uae|united arab emirates|emirates|dubai|abu dhabi|sharjah)\b/,
    regions: /\b(mena|middle east|emea|gcc)\b/,
  },
  India: {
    words:
      /\b(india|bangalore|bengaluru|hyderabad|pune|mumbai|delhi|new delhi|gurgaon|gurugram|noida|chennai|kolkata|ahmedabad)\b/,
    regions: /\b(apac|asia|south asia)\b/,
  },
  Australia: {
    words: /\b(australia|sydney|melbourne|brisbane|perth|adelaide|canberra)\b/,
    regions: /\b(apac|asia pacific|oceania|anz)\b/,
  },
};

const WORLDWIDE = /\b(worldwide|anywhere|global|globally|international|any location)\b/;
const REGION_WORDS =
  /\b(europe|emea|eu|apac|asia|americas|north america|latam|south america|central america|africa|mena|middle east|oceania)\b/;

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** How well a job's location fits the target: 2 exact, 1 remote-compatible, 0 no. */
export function locationFit(job: FeedJob, target: string, workMode: string): 0 | 1 | 2 {
  if (!target || target === "Anywhere") return 2;
  const raw = [job.location, ...(job.locations ?? [])].join(" ; ");
  const loc = ` ${stripDiacritics(raw)
    .toLowerCase()
    .replace(/[^a-z0-9,;]+/g, " ")} `;
  const remote = job.workMode === "Remote" || /\bremote\b/.test(loc);
  // "Remote" with no region, or explicitly worldwide / anywhere — and not tied
  // to a specific country ("Remote - US: All locations" is US-only).
  const tiedToCountry = Object.values(LOCATION_ALIASES).some(
    (a) => a.words.test(loc) || (a.codes ? a.codes.test(raw) : false),
  );
  const worldwide =
    remote &&
    !tiedToCountry &&
    (WORLDWIDE.test(loc) ||
      (!REGION_WORDS.test(loc) &&
        /^(remote|see listing|see post|\s)*$/.test(
          loc.replace(/[;,]/g, " ").replace(/\b(fully|100)\b/g, ""),
        )));

  if (target === "Remote (Worldwide)") return worldwide ? 2 : 0;

  const alias = LOCATION_ALIASES[target];
  if (!alias) return loc.includes(target.toLowerCase()) ? 2 : 0;
  if (alias.words.test(loc) || (alias.codes && alias.codes.test(raw))) return 2;
  if (workMode === "Onsite" || workMode === "Hybrid") return 0;
  if (worldwide) return 1;
  if (remote && alias.regions.test(loc)) return 1;
  return 0;
}

export function modeFits(mode: WorkModeValue, filter: string): boolean {
  if (filter === "Any") return true;
  if (filter === "Remote") return mode === "Remote";
  return mode === filter || mode === "Unspecified";
}

export function timeframeMs(t: Timeframe): number | null {
  switch (t) {
    case "Past 24 hours":
      return 24 * 3600_000;
    case "Past 3 days":
      return 72 * 3600_000;
    case "Past week":
      return 7 * 24 * 3600_000;
    case "Past month":
      return 31 * 24 * 3600_000;
    default:
      return null;
  }
}

/* --------------------------------------------------------------- scoring */

/**
 * Relevance of a structured posting to the search, 0-100, or null when it
 * doesn't match (wrong role, location, mode or timeframe).
 */
export function scoreJob(
  job: FeedJob,
  q: ParsedQuery,
  args: JobSearchArgs,
  now = Date.now(),
): number | null {
  if (!modeFits(job.workMode, args.workMode)) return null;

  const window = timeframeMs(args.timeframe);
  if (window != null && (!job.postedAt || now - job.postedAt > window)) return null;

  const fit = locationFit(job, args.location, args.workMode);
  if (fit === 0) return null;

  const titleText = job.header ?? job.title;
  const title = tokenSet(titleText);
  const extra = tokenSet(`${(job.tags ?? []).join(" ")} ${job.description}`);

  const inTitle = q.core.filter((w) => title.has(w)).length;
  const inAny = q.core.filter((w) => title.has(w) || extra.has(w)).length;
  const n = q.core.length;
  if (!n) return null;

  // Title must carry the role: all words for short queries, most for long ones.
  const needed = n <= 2 ? n : Math.ceil(n * 0.66);
  if (inTitle < needed || inAny < n) return null;

  const titleNorm = normalise(titleText);
  let score = 45 + 30 * (inTitle / n);
  if (q.phrase && titleNorm.includes(q.phrase)) score += 12;

  // Seniority is a preference, except juniors shouldn't see senior/lead roles
  // and intern searches only want internships.
  if (q.seniority.length) {
    const wantsJunior = q.seniority.some((s) => JUNIOR.has(s));
    const has = q.seniority.some((s) => title.has(s));
    if (q.seniority.includes("intern") && !title.has("intern")) return null;
    if (wantsJunior && SENIOR_TITLE.test(titleNorm) && !has) return null;
    if (has) score += 10;
  }
  if (!q.core.includes("manager") && LEADERSHIP_TITLE.test(titleNorm)) score -= 18;

  if (fit === 2 && args.location !== "Anywhere") score += 6;
  if (fit === 1) score -= 6;

  if (job.postedAt) {
    const days = (now - job.postedAt) / 86_400_000;
    if (days <= 1) score += 8;
    else if (days <= 7) score += 5;
    else if (days <= 30) score += 2;
    else if (days > 90) score -= 8;
  }
  return Math.max(1, Math.min(100, Math.round(score)));
}

/** Title-only relevance for web-search hits (no structured fields). */
export function titleMatches(title: string, q: ParsedQuery): boolean {
  const t = tokenSet(title);
  const hits = q.core.filter((w) => t.has(w)).length;
  return q.core.length <= 2 ? hits === q.core.length : hits >= Math.ceil(q.core.length * 0.6);
}

export function timeAgo(ms: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - ms) / 60_000));
  if (mins < 60) return mins <= 1 ? "Just posted" : `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.round(hrs / 24);
  if (days < 31) return days === 1 ? "1 day ago" : `${days} days ago`;
  const months = Math.round(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}
