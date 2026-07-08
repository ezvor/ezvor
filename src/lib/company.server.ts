// Server-only company-intelligence helpers.
//
// Given a target role + company, we gather fresh public context with Firecrawl
// (blogs, articles, interview write-ups) and distill it into a compact,
// structured brief with the AI gateway. The .server.ts suffix keeps API keys
// and the Firecrawl SDK out of the client bundle.

import Firecrawl from "@mendable/firecrawl-js";

import { callAI, type ChatMessage } from "./ai.server";

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
}

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

/** Search public sources for interview / culture / hiring context. */
async function gatherContext(company: string, role: string): Promise<SearchHit[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return [];

  const fc = new Firecrawl({ apiKey });
  const query = `${company} ${role} interview process hiring rounds coding system design culture`;

  try {
    const res = (await fc.search(query, {
      limit: 6,
      scrapeOptions: { formats: ["markdown"] },
    })) as {
      web?: { title?: string; url?: string; description?: string; markdown?: string }[];
      data?: { title?: string; url?: string; description?: string; markdown?: string }[];
    };

    const rows = res.web ?? res.data ?? [];
    return rows
      .filter((r) => r.url)
      .slice(0, 6)
      .map((r) => ({
        title: r.title || r.url || "Source",
        url: r.url as string,
        snippet: (r.markdown || r.description || "").slice(0, 1500),
      }));
  } catch {
    return [];
  }
}

const tools = [
  {
    type: "function",
    function: {
      name: "company_brief",
      description: "Return a compact, accurate hiring brief for a company + role.",
      parameters: {
        type: "object",
        properties: {
          overview: {
            type: "string",
            description: "1-2 sentence factual overview of the company and what the role does there.",
          },
          culture: {
            type: "array",
            description: "3-5 short bullet points about work culture and values.",
            items: { type: "string" },
          },
          requirements: {
            type: "array",
            description: "3-6 concrete qualifications / experience they look for.",
            items: { type: "string" },
          },
          techStack: {
            type: "array",
            description: "Key technologies, languages, frameworks and tools used for this role.",
            items: { type: "string" },
          },
          skills: {
            type: "array",
            description: "Core skills and competencies expected.",
            items: { type: "string" },
          },
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
              additionalProperties: false,
            },
          },
          focus: {
            type: "array",
            description: "How much each evaluation area matters, e.g. DSA, System Design, CS fundamentals, Behavioral, Projects.",
            items: {
              type: "object",
              properties: {
                area: { type: "string" },
                importance: { type: "string", enum: ["High", "Medium", "Low"] },
                note: { type: "string", description: "Short note on what to expect for this area." },
              },
              required: ["area", "importance", "note"],
              additionalProperties: false,
            },
          },
          onboarding: {
            type: "string",
            description: "1-2 sentences on what onboarding / first weeks typically look like.",
          },
          tips: {
            type: "array",
            description: "3-5 sharp, actionable tips to stand out.",
            items: { type: "string" },
          },
        },
        required: [
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
        additionalProperties: false,
      },
    },
  },
];

export async function buildCompanyIntel(company: string, role: string): Promise<CompanyIntel> {
  const hits = await gatherContext(company, role);

  const context = hits.length
    ? hits
        .map((h, i) => `[Source ${i + 1}] ${h.title}\n${h.url}\n${h.snippet}`)
        .join("\n\n---\n\n")
    : "No live sources were retrieved. Use your best, honest general knowledge and clearly avoid inventing specifics.";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a sharp technical recruiter and interview coach. Produce an accurate, concise hiring brief for a specific company and role. Prefer facts grounded in the provided sources. If sources are thin, rely on well-established general knowledge and keep claims safe and non-specific rather than fabricating exact details (never invent salary figures, named recruiters, or exact question banks). Keep every field tight and skimmable.",
    },
    {
      role: "user",
      content: `Company: ${company}\nTarget role: ${role}\n\nResearched context:\n${context}\n\nWrite the structured brief.`,
    },
  ];

  const res = await callAI(messages, {
    tools,
    tool_choice: { type: "function", function: { name: "company_brief" } },
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    throw new Error("AI service error");
  }

  const out = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const argStr = out?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argStr) throw new Error("No brief returned");

  const parsed = JSON.parse(argStr) as Omit<CompanyIntel, "company" | "role" | "resources">;

  // Only surface real, retrieved links as resources.
  const seen = new Set<string>();
  const resources: IntelResource[] = [];
  for (const h of hits) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    resources.push({ title: h.title, url: h.url });
    if (resources.length >= 5) break;
  }

  return { company, role, resources, ...parsed };
}
