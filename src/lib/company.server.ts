// Server-only company-intelligence helpers.
//
// Given a target role + company we gather fresh public context (web search +
// the company's Wikipedia summary) and distill it into a compact, structured
// brief with the AI layer. Unknown or made-up companies are reported honestly
// (`recognized: false`) with generic role preparation, and when every AI
// provider is busy a template brief built from the same sources is returned.

import { aiJSON, type ChatMessage } from "./ai.server";
import { webSearch } from "./web.server";

export interface IntelResource {
  title: string;
  url: string;
}

export interface IntelFocusArea {
  area: string;
  importance: "High" | "Medium" | "Low";
  note: string;
}

export interface CompanyIntel {
  company: string;
  role: string;
  recognized: boolean;
  note: string;
  overview: string;
  culture: string[];
  requirements: string[];
  techStack: string[];
  skills: string[];
  interviewProcess: { stage: string; detail: string }[];
  focus: IntelFocusArea[];
  onboarding: string;
  tips: string[];
  resources: IntelResource[];
  /** What the brief was grounded on. */
  grounding?: { wikipedia: string | null; webSources: number };
  /** True when AI was unavailable and a template brief was used. */
  fallback?: boolean;
}

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

interface WikiSummary {
  title: string;
  url: string;
  description: string;
  extract: string;
}

const UA = "EzvorBot/1.0 (career research; https://github.com/ezvor)";

/* --------------------------------------------------------------- sources */

/** Search public sources for interview / culture / hiring context. */
async function gatherWeb(company: string, role: string): Promise<SearchHit[]> {
  const queries = [
    `${company} ${role} interview process rounds`,
    `${company} engineering culture tech stack`,
  ];
  const results = await Promise.all(queries.map((q) => webSearch(q, { limit: 5 }).catch(() => [])));
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const r of results.flat()) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    out.push({
      title: r.title || r.url,
      url: r.url,
      snippet: (r.markdown || r.description || "").slice(0, 1200),
    });
  }
  return out.slice(0, 8);
}

const ORG_WORDS =
  /\b(company|corporation|corp|inc|founded|headquartered|startup|platform|software|business|firm|organi[sz]ation|bank|technology|technologies|conglomerate|multinational|provider|developer|manufacturer|retailer|brand|service|subsidiary|agency|university|group|app)\b/i;

function compact(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function wikiJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Find the company's Wikipedia article, if one clearly exists. */
async function findWikipedia(company: string): Promise<WikiSummary | null> {
  const search = await wikiJSON<{ query?: { search?: { title: string }[] } }>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srprop=&srsearch=${encodeURIComponent(
      `${company} company`,
    )}`,
  );
  const want = compact(company);
  const candidates = (search?.query?.search ?? [])
    .map((s) => s.title)
    // The article title must actually be about this name ("Stripe, Inc." for "stripe").
    .filter((t) => {
      const c = compact(t.replace(/\(.*?\)/g, ""));
      return c === want || c.startsWith(want) || (want.length >= 5 && c.includes(want));
    })
    .slice(0, 2);

  for (const title of candidates) {
    const s = await wikiJSON<{
      type?: string;
      title?: string;
      description?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    }>(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    );
    if (!s || s.type === "disambiguation" || !s.extract) continue;
    if (!ORG_WORDS.test(`${s.description ?? ""} ${s.extract.slice(0, 400)}`)) continue;
    return {
      title: s.title ?? title,
      url:
        s.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      description: s.description ?? "",
      extract: s.extract.slice(0, 1400),
    };
  }
  return null;
}

/** Cheap gibberish detector for obviously-fake company names. */
function looksLikeGibberish(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (n.length < 2) return true;
  const letters = n.replace(/[^a-z]/g, "");
  if (!letters) return true;
  const vowels = (letters.match(/[aeiou]/g) || []).length;
  const vowelRatio = vowels / letters.length;
  // A single long token with almost no vowels is almost certainly keyboard mash.
  const singleToken = !/\s/.test(n);
  const longConsonantRun = /[bcdfghjklmnpqrstvwxyz]{6,}/.test(letters);
  return (singleToken && letters.length >= 10 && vowelRatio < 0.28) || longConsonantRun;
}

/** Web hits that actually mention the company by name. */
function mentions(hits: SearchHit[], company: string): number {
  const want = compact(company);
  if (want.length < 2) return 0;
  return hits.filter((h) =>
    compact(`${h.title} ${h.url} ${h.snippet.slice(0, 300)}`).includes(want),
  ).length;
}

/* ---------------------------------------------------------------- schema */

const BRIEF_SCHEMA = {
  name: "company_brief",
  description: "Return a compact, accurate hiring brief for a company + role.",
  parameters: {
    type: "object",
    properties: {
      recognized: {
        type: "boolean",
        description:
          "true only if this is a real, identifiable organization you can speak to with confidence (from sources or well-established knowledge). false for gibberish, test strings, or companies you cannot verify.",
      },
      note: {
        type: "string",
        description:
          "If recognized is false: one friendly sentence that the company could not be verified and the brief is generic role preparation. Otherwise an empty string.",
      },
      overview: {
        type: "string",
        description:
          "1-2 factual sentences about the company and what the role does there. If unrecognized, describe the ROLE generically without inventing company facts.",
      },
      culture: {
        type: "array",
        items: { type: "string" },
        description: "3-5 short points on culture and values.",
      },
      requirements: {
        type: "array",
        items: { type: "string" },
        description: "3-6 concrete qualifications they look for.",
      },
      techStack: {
        type: "array",
        items: { type: "string" },
        description: "Key technologies, languages, frameworks and tools for this role.",
      },
      skills: { type: "array", items: { type: "string" }, description: "Core skills expected." },
      interviewProcess: {
        type: "array",
        description: "Ordered interview stages from application to offer.",
        items: {
          type: "object",
          properties: {
            stage: { type: "string", description: "Short stage name, e.g. 'Recruiter screen'." },
            detail: { type: "string", description: "One concise sentence about what happens." },
          },
          required: ["stage", "detail"],
        },
      },
      focus: {
        type: "array",
        description:
          "How much each area matters: DSA, System Design, CS fundamentals, Behavioral, Projects…",
        items: {
          type: "object",
          properties: {
            area: { type: "string" },
            importance: { type: "string", enum: ["High", "Medium", "Low"] },
            note: { type: "string", description: "Short note on what to expect." },
          },
          required: ["area", "importance", "note"],
        },
      },
      onboarding: { type: "string", description: "1-2 sentences on the first weeks." },
      tips: {
        type: "array",
        items: { type: "string" },
        description: "3-5 sharp, actionable tips.",
      },
    },
    required: [
      "recognized",
      "note",
      "overview",
      "culture",
      "requirements",
      "techStack",
      "skills",
      "interviewProcess",
      "focus",
      "onboarding",
      "tips",
    ],
  },
} as const;

type Brief = Omit<CompanyIntel, "company" | "role" | "resources" | "grounding" | "fallback">;

/* ------------------------------------------------------------ validation */

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function strList(v: unknown, maxItems = 8, maxLen = 200): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = str(typeof item === "string" ? item : (item as { name?: string })?.name, maxLen);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitize(raw: Partial<Brief> & Record<string, unknown>, fallback: Brief): Brief {
  const interview = Array.isArray(raw.interviewProcess)
    ? raw.interviewProcess
        .map((s) => ({ stage: str(s?.stage, 60), detail: str(s?.detail, 240) }))
        .filter((s) => s.stage)
        .slice(0, 8)
    : [];
  const focus = Array.isArray(raw.focus)
    ? raw.focus
        .map((f) => ({
          area: str(f?.area, 60),
          importance: (["High", "Medium", "Low"] as const).includes(f?.importance as "High")
            ? (f.importance as IntelFocusArea["importance"])
            : "Medium",
          note: str(f?.note, 200),
        }))
        .filter((f) => f.area)
        .slice(0, 7)
    : [];
  const pick = <T>(v: T[], d: T[]) => (v.length ? v : d);
  return {
    recognized: typeof raw.recognized === "boolean" ? raw.recognized : fallback.recognized,
    note: str(raw.note, 300),
    overview: str(raw.overview, 600) || fallback.overview,
    culture: pick(strList(raw.culture, 6), fallback.culture),
    requirements: pick(strList(raw.requirements, 7), fallback.requirements),
    techStack: pick(strList(raw.techStack, 14, 40), fallback.techStack),
    skills: pick(strList(raw.skills, 10, 80), fallback.skills),
    interviewProcess: pick(interview, fallback.interviewProcess),
    focus: pick(focus, fallback.focus),
    onboarding: str(raw.onboarding, 400) || fallback.onboarding,
    tips: pick(strList(raw.tips, 6, 240), fallback.tips),
  };
}

/* -------------------------------------------------------------- template */

type Family =
  | "frontend"
  | "backend"
  | "data"
  | "ml"
  | "devops"
  | "mobile"
  | "qa"
  | "design"
  | "product"
  | "swe";

function roleFamily(role: string): Family {
  const r = role.toLowerCase();
  if (/front[\s-]?end|react|angular|vue|\bui\b(?!\s*\/?\s*ux)/.test(r)) return "frontend";
  if (/machine learning|\bml\b|\bai\b|deep learning|nlp|computer vision/.test(r)) return "ml";
  if (/data (analyst|scien|engineer)|analytics|\bbi\b|business intelligence/.test(r)) return "data";
  if (/devops|\bsre\b|site reliability|platform|cloud|infrastructure|security/.test(r))
    return "devops";
  if (/android|ios|mobile|flutter|react native/.test(r)) return "mobile";
  if (/\bqa\b|\bsqa\b|test|quality/.test(r)) return "qa";
  if (/design|ux|ui\/ux/.test(r)) return "design";
  if (/product manager|\bpm\b|program manager/.test(r)) return "product";
  if (/back[\s-]?end|server|api|java|golang|node/.test(r)) return "backend";
  return "swe";
}

const STACKS: Record<Family, string[]> = {
  frontend: [
    "TypeScript",
    "React",
    "Next.js",
    "CSS / Tailwind",
    "Testing Library",
    "Web performance",
  ],
  backend: ["Java / Go / Python", "REST & gRPC", "PostgreSQL", "Redis", "Kafka", "Docker"],
  data: ["SQL", "Python (pandas)", "dbt", "Airflow", "Looker / Tableau", "Spark"],
  ml: [
    "Python",
    "PyTorch",
    "NumPy / pandas",
    "Experiment tracking",
    "Vector databases",
    "Cloud GPUs",
  ],
  devops: [
    "Linux",
    "Docker",
    "Kubernetes",
    "Terraform",
    "CI/CD",
    "AWS / GCP",
    "Prometheus / Grafana",
  ],
  mobile: [
    "Kotlin / Swift",
    "Jetpack Compose / SwiftUI",
    "React Native / Flutter",
    "REST APIs",
    "App store releases",
  ],
  qa: [
    "Test design",
    "Playwright / Cypress",
    "API testing (Postman)",
    "CI pipelines",
    "SQL",
    "Bug tracking",
  ],
  design: ["Figma", "Design systems", "Prototyping", "User research", "Accessibility (WCAG)"],
  product: [
    "Roadmapping",
    "Analytics (SQL, Amplitude)",
    "User research",
    "Specs / PRDs",
    "Experimentation",
  ],
  swe: [
    "One strong language (Python / Java / C++ / TypeScript)",
    "Git",
    "SQL",
    "REST APIs",
    "Cloud basics",
    "Testing",
  ],
};

const FOCUS: Record<Family, IntelFocusArea[]> = {
  frontend: [
    {
      area: "JavaScript & browser fundamentals",
      importance: "High",
      note: "Closures, event loop, rendering, accessibility.",
    },
    {
      area: "UI coding exercise",
      importance: "High",
      note: "Build a small component or widget live.",
    },
    {
      area: "DSA",
      importance: "Medium",
      note: "Arrays, strings, hash maps at LeetCode easy–medium.",
    },
    {
      area: "Frontend system design",
      importance: "Medium",
      note: "State, data fetching, caching, performance.",
    },
    { area: "Behavioral", importance: "Medium", note: "Collaboration with design and product." },
  ],
  backend: [
    {
      area: "DSA",
      importance: "High",
      note: "LeetCode medium: graphs, trees, hashing, two pointers.",
    },
    {
      area: "System design",
      importance: "High",
      note: "APIs, databases, caching, queues, scaling.",
    },
    { area: "CS fundamentals", importance: "Medium", note: "Concurrency, networking, databases." },
    {
      area: "Behavioral",
      importance: "Medium",
      note: "Ownership, incidents, trade-offs you made.",
    },
  ],
  data: [
    {
      area: "SQL",
      importance: "High",
      note: "Joins, window functions, aggregations under time pressure.",
    },
    {
      area: "Statistics & metrics",
      importance: "High",
      note: "A/B tests, distributions, metric definitions.",
    },
    {
      area: "Case study",
      importance: "Medium",
      note: "Turn a vague business question into an analysis.",
    },
    {
      area: "Behavioral",
      importance: "Medium",
      note: "Communicating insights to non-technical people.",
    },
  ],
  ml: [
    {
      area: "ML fundamentals",
      importance: "High",
      note: "Bias/variance, evaluation, common model families.",
    },
    { area: "Coding / DSA", importance: "High", note: "Python fluency plus LeetCode medium." },
    {
      area: "ML system design",
      importance: "Medium",
      note: "Data pipelines, training, serving, monitoring.",
    },
    {
      area: "Projects",
      importance: "Medium",
      note: "Deep-dive into a model you built and shipped.",
    },
  ],
  devops: [
    {
      area: "Linux & networking",
      importance: "High",
      note: "Processes, DNS, TCP, debugging live systems.",
    },
    { area: "Cloud & IaC", importance: "High", note: "Terraform, Kubernetes, CI/CD design." },
    {
      area: "Troubleshooting scenario",
      importance: "Medium",
      note: "Walk through an outage step by step.",
    },
    { area: "Coding", importance: "Medium", note: "Scripting in Python / Bash / Go." },
  ],
  mobile: [
    {
      area: "Platform fundamentals",
      importance: "High",
      note: "Lifecycle, threading, memory, offline.",
    },
    { area: "Coding / DSA", importance: "Medium", note: "LeetCode easy–medium." },
    {
      area: "App architecture",
      importance: "Medium",
      note: "MVVM, modularisation, state management.",
    },
    { area: "Behavioral", importance: "Medium", note: "Shipping and supporting releases." },
  ],
  qa: [
    {
      area: "Test design",
      importance: "High",
      note: "Derive cases from a spec: edge cases, negative paths.",
    },
    { area: "Automation", importance: "High", note: "Write and structure UI / API test suites." },
    { area: "Coding", importance: "Medium", note: "Basic scripting and data structures." },
    {
      area: "Behavioral",
      importance: "Medium",
      note: "Reporting bugs and working with developers.",
    },
  ],
  design: [
    {
      area: "Portfolio review",
      importance: "High",
      note: "Walk through problem, process and outcome.",
    },
    {
      area: "Design exercise",
      importance: "High",
      note: "Whiteboard or take-home product design task.",
    },
    { area: "Collaboration", importance: "Medium", note: "Working with PMs and engineers." },
  ],
  product: [
    {
      area: "Product sense",
      importance: "High",
      note: "Design or improve a product for a user segment.",
    },
    { area: "Analytics", importance: "High", note: "Define metrics, diagnose a metric drop." },
    { area: "Execution", importance: "Medium", note: "Prioritisation and trade-offs." },
    { area: "Behavioral", importance: "Medium", note: "Leadership without authority." },
  ],
  swe: [
    {
      area: "DSA",
      importance: "High",
      note: "LeetCode easy–medium: arrays, hashing, trees, graphs.",
    },
    {
      area: "CS fundamentals",
      importance: "Medium",
      note: "OOP, databases, operating systems, networking.",
    },
    {
      area: "System design",
      importance: "Low",
      note: "Basic design for junior roles; deeper for senior.",
    },
    {
      area: "Behavioral",
      importance: "Medium",
      note: "Projects, teamwork and learning from mistakes.",
    },
  ],
};

function templateBrief(
  company: string,
  role: string,
  recognized: boolean,
  wiki: WikiSummary | null,
): Brief {
  const family = roleFamily(role);
  const stack = STACKS[family];
  return {
    recognized,
    note: "",
    overview: wiki
      ? `${wiki.extract
          .split(/(?<=\.)\s/)
          .slice(0, 2)
          .join(" ")}`
      : `A ${role} owns a clear slice of the team's work end to end and collaborates closely with product, design and engineering peers.`,
    culture: [
      "Ownership of outcomes, not just tasks",
      "Clear written and verbal communication",
      "Collaboration across teams and time zones",
      "Continuous learning and code/design review",
    ],
    requirements: [
      `Solid fundamentals for a ${role} role`,
      `Hands-on experience with ${stack.slice(0, 3).join(", ")}`,
      "Projects or work you can walk through in depth",
      "Ability to explain trade-offs clearly",
    ],
    techStack: stack,
    skills: [
      "Problem solving",
      "Communication",
      "Debugging",
      "Testing mindset",
      "Learning quickly",
    ],
    interviewProcess: [
      {
        stage: "Application & resume screen",
        detail: "Recruiters look for relevant projects and impact.",
      },
      { stage: "Recruiter call", detail: "Background, motivation, logistics and expectations." },
      { stage: "Technical screen", detail: `A role-specific exercise for ${role} candidates.` },
      {
        stage: "Onsite / virtual loop",
        detail: "Several interviews covering skills, design and behavior.",
      },
      { stage: "Offer", detail: "Team matching and offer discussion." },
    ],
    focus: FOCUS[family],
    onboarding:
      "Expect setup, codebase or domain walkthroughs and a small first task within the first couple of weeks.",
    tips: [
      `Research ${company}'s product and recent news before every round`,
      "Prepare 3-4 STAR stories about projects, conflict and failure",
      "Think out loud and clarify requirements before solving",
      "Practice timed problems on Ezvor's problem set",
    ],
  };
}

/* ----------------------------------------------------------------- build */

const cache = new Map<string, { at: number; value: CompanyIntel }>();
const CACHE_TTL = 6 * 3600_000;

export async function buildCompanyIntel(company: string, role: string): Promise<CompanyIntel> {
  const key = `${compact(company)}|${compact(role)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;

  const [hits, wiki] = await Promise.all([gatherWeb(company, role), findWikipedia(company)]);
  const named = mentions(hits, company);
  const gibberish = looksLikeGibberish(company);
  // Hard evidence either way; the AI decides the grey zone.
  const verified = !!wiki || named >= 2;
  const suspicious = !wiki && named === 0 && (gibberish || hits.length === 0);

  const context = [
    wiki ? `[Wikipedia] ${wiki.title} — ${wiki.description}\n${wiki.url}\n${wiki.extract}` : "",
    ...hits.map((h, i) => `[Source ${i + 1}] ${h.title}\n${h.url}\n${h.snippet}`),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a sharp technical recruiter and interview coach. First judge whether the company is a real, identifiable organization. " +
        "If it is, write an accurate, concise hiring brief grounded in the sources or well-established knowledge; never invent salary figures, recruiter names or exact question banks. " +
        "If the name looks like gibberish or you cannot verify it, set recognized=false, add a short friendly note, and fill every other field with solid GENERIC preparation for the target role without company-specific claims. Keep every field tight and skimmable.",
    },
    {
      role: "user",
      content:
        `Company: ${company}\nTarget role: ${role}\n` +
        (verified ? "Evidence: this company is documented in the sources below.\n" : "") +
        (suspicious
          ? "Heuristic flag: no source mentions this name and it may be random text. Treat it as unrecognized unless you have strong evidence otherwise.\n"
          : "") +
        `\nResearched context:\n${context || "No live sources were retrieved for this company name."}\n\nWrite the structured brief.`,
    },
  ];

  const template = templateBrief(company, role, verified, wiki);
  let brief: Brief;
  let fallback = false;
  try {
    const raw = await aiJSON<Partial<Brief> & Record<string, unknown>>(messages, BRIEF_SCHEMA, {
      tier: "smart",
      timeoutMs: 60_000,
    });
    brief = sanitize(raw, template);
  } catch (e) {
    console.warn("[company] AI brief failed, using template:", e instanceof Error ? e.message : e);
    brief = template;
    fallback = true;
  }

  // Evidence overrides the model in both directions.
  const recognized = suspicious ? false : verified ? true : brief.recognized;
  const note = recognized
    ? ""
    : brief.note ||
      `We couldn't verify "${company}" as a registered organization, so this is generic ${role} preparation. Double-check the exact company name, or start prepping the fundamentals below anyway.`;
  if (!recognized && fallback) brief.overview = templateBrief(company, role, false, null).overview;

  // Only surface real, retrieved links as resources.
  const seen = new Set<string>();
  const resources: IntelResource[] = [];
  for (const r of [
    ...(wiki ? [{ title: `${wiki.title} — Wikipedia`, url: wiki.url }] : []),
    ...hits,
  ]) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    resources.push({ title: r.title, url: r.url });
    if (resources.length >= 6) break;
  }

  const result: CompanyIntel = {
    company,
    role,
    ...brief,
    recognized,
    note,
    resources,
    grounding: { wikipedia: wiki?.title ?? null, webSources: hits.length },
    fallback,
  };
  // Don't pin a template brief for hours; AI may be back soon.
  if (!fallback) {
    cache.set(key, { at: Date.now(), value: result });
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return result;
}
