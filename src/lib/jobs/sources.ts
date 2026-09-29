// User-facing job source filters (safe to import from client code).
// The first four are served by free job APIs; the rest by web search.

export const SOURCE_KEYS = [
  "Company career pages",
  "Remote boards",
  "Hacker News",
  "Arbeitnow (EU)",
  "LinkedIn",
  "Indeed",
  "Glassdoor",
  "Y Combinator",
] as const;

export type SourceKey = (typeof SOURCE_KEYS)[number];

export const SOURCE_HINTS: Record<SourceKey, string> = {
  "Company career pages": "Greenhouse, Lever & Ashby boards of ~55 tech companies",
  "Remote boards": "Remotive, RemoteOK, We Work Remotely, Wellfound",
  "Hacker News": "This month's “Who is hiring?” thread",
  "Arbeitnow (EU)": "Tech roles across Germany & Europe",
  LinkedIn: "Web search of public LinkedIn postings",
  Indeed: "Web search of public Indeed postings",
  Glassdoor: "Web search of public Glassdoor postings",
  "Y Combinator": "YC startups via Work at a Startup",
};
