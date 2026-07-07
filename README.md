# Ezvor

Ezvor is a career platform for software engineers. It pulls together the things I kept opening ten different tabs for — real opportunities, structured roadmaps, a place to actually practice DSA, and an honest answer to the only question that matters when you're job hunting: *am I ready yet?*

Most "career" sites are either link dumps or motivational fluff. I wanted something that measures real work and tells you the truth.

**Live:** https://ezvor.lovable.app
**Repo:** https://github.com/ezvor/ezvor

---

## Why I built this

I was preparing for internships and interviews and got tired of the workflow: check three job boards, bookmark a roadmap I'd never finish, grind problems on one site, then have no idea whether any of it added up to being hireable. Progress felt invisible.

So the goal here was pretty specific — track the actual, verifiable work (problems that genuinely pass the judge, roadmap skills you can defend) and turn it into a single readiness score you can't fake. Everything else in the app feeds that.

## What it does

- **Readiness Engine** — the core of the whole thing. It takes your *server-verified* activity (problems that were actually accepted by the judge, roadmap skills marked mastered) plus a target role, and computes a deterministic readiness score with a pillar breakdown (foundations, DSA, consistency, proof) and the highest-impact next moves. No AI in this part on purpose — same evidence always produces the same score, so it can't be gamed and never silently breaks.
- **DSA Arena / Playground** — a LeetCode-style editor (Monaco) with multi-language compile & run, hidden test cases, and runtime/memory feedback. A problem only counts toward readiness once it's genuinely accepted.
- **Opportunities** — open-source programs and jobs (GSoC, LFX, Outreachy, internships) with live Open/Closed/Rolling status scraped from the source pages, so you're not applying to something that closed two weeks ago.
- **Roadmaps** — interactive, expandable graph roadmaps across domains (frontend, backend, data, DevOps, etc.), with free resources mapped to each node.
- **AI Advisor** — a chat advisor with persistent history for the softer questions the score can't answer.
- **Compiler** — a standalone online compiler for quick throwaway code.

## Tech stack

I stayed deliberately boring where it mattered and modern where it paid off.

- **Framework:** TanStack Start (React 19, SSR, file-based routing)
- **Build:** Vite 7
- **Language:** TypeScript, strict mode
- **Styling:** Tailwind CSS v4 + shadcn/ui, monochrome dark theme
- **Backend:** Supabase (Postgres, Auth, Row-Level Security)
- **Code execution:** external sandbox judge API
- **Scraping:** Firecrawl for live opportunity status
- **AI:** model gateway with a Google Gemini fallback
- **Editor:** Monaco

Server logic runs through TanStack `createServerFn` and a couple of public API routes for webhooks/cron — no separate backend service to babysit.

## Architecture notes

A few decisions worth calling out, since they're the parts I'd defend in a review:

- **Readiness is pure and deterministic.** It lives in `src/lib/readiness.ts` with no network and no AI calls. The score is a function of evidence, nothing else. That makes it testable and trustworthy — the whole point of the app falls apart if the number can be nudged.
- **Trust the judge, not the user.** A problem contributes to your score only after the execution backend returns *accepted*. The client can't self-report progress.
- **Server functions over an API layer.** Anything touching the database or secrets runs server-side via `createServerFn`; the client only ever holds the publishable key. RLS is on for every table.
- **SSR-safe by default.** Browser-only work (editor, storage reads) is kept out of module scope so the prerender/build step doesn't fall over.

## Project structure

```text
src/
├── components/        # UI + shadcn primitives, sidebar, editor, roadmap graph
├── data/              # static datasets (problems, roadmaps, opportunities)
├── integrations/
│   └── supabase/      # generated clients (don't hand-edit)
├── lib/               # server functions + core logic
│   ├── readiness.ts   # the deterministic readiness engine
│   ├── judge.*        # code execution
│   ├── ai.server.ts   # AI gateway
│   └── firecrawl.server.ts
├── routes/            # file-based routes (pages + api)
│   ├── __root.tsx     # app shell
│   ├── _authenticated/# gated routes (readiness, advisor)
│   └── api/           # webhooks / cron / chat
└── styles.css         # Tailwind v4 theme + tokens
supabase/migrations/   # database schema
```

## Running it locally

Requires **Bun >= 1.0** (Node 20+ works too) and **Git**.

```bash
git clone https://github.com/ezvor/ezvor.git
cd ezvor
bun install
bun run dev
```

App comes up on http://localhost:8080.

### Environment

Create a `.env` in the root:

```env
# Supabase
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_PROJECT_ID="your-project-id"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-anon-key"

# Server-only
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
GEMINI_API_KEY="your-google-ai-studio-key"   # free tier is fine
FIRECRAWL_API_KEY="your-firecrawl-key"        # for live opportunity status
```

Notes:
- `VITE_*` values are exposed to the browser — keep them public-safe.
- Server secrets are read via `process.env` inside server functions. Never prefix them with `VITE_`.
- Grab a free Gemini key from https://aistudio.google.com/apikey and a Firecrawl key from https://firecrawl.dev.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | dev server with hot reload |
| `bun run build` | production build |
| `bun run build:dev` | dev-mode build (useful for debugging SSR) |
| `bun run preview` | preview a production build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |

## Database

Postgres via Supabase. Schema lives in `supabase/migrations/`. If you're self-hosting against your own project, run the migrations and regenerate the types in `src/integrations/supabase/`. Every public table has RLS enabled — the app assumes it.

## Deployment

Ezvor is server-rendered, so it needs a host that runs server functions — a static host won't cut it. It's currently deployed at https://ezvor.lovable.app. Any platform that supports Node/edge SSR (Vercel, Netlify, etc.) works: connect the repo, set the environment variables above, deploy.

## Roadmap / things I'd still like to do

- Broaden the opportunity sources and add filtering by region/eligibility
- Per-user consistency streaks feeding the readiness "consistency" pillar more granularly
- Shareable readiness reports
- More languages in the judge

## License

Open source. Add a `LICENSE` file (MIT is a fine default) if you plan to reuse it.
