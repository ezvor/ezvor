<div align="center">

<img src="public/ezvor-banner.png" alt="Ezvor" width="100%" />

<br />

**The career platform that measures real work and tells you the truth: are you hireable yet?**

[![Live](https://img.shields.io/badge/Live-ezvor.lovable.app-white?style=for-the-badge)](https://ezvor.lovable.app)
[![React](https://img.shields.io/badge/React_19-black?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-black?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![TanStack Start](https://img.shields.io/badge/TanStack_Start-black?style=for-the-badge)](https://tanstack.com/start)

[Live App](https://ezvor.lovable.app) · [Report a Bug](https://github.com/ezvor/ezvor/issues) · [Request a Feature](https://github.com/ezvor/ezvor/issues)

</div>

---

## The problem

I was preparing for internships and interviews and got tired of the workflow. Check three job boards, bookmark a roadmap I would never finish, grind problems on one site, then have no idea whether any of it added up to being hireable. Progress felt invisible.

Most "career" sites are one of two things: link dumps or motivational fluff. I wanted something that measures real work and gives you an honest answer.

## What Ezvor does

Ezvor pulls together the things I kept opening ten different tabs for, and turns your actual, verifiable effort into a single readiness score you cannot fake.

| | Feature | What it gives you |
| :---: | :--- | :--- |
| 🎯 | **Readiness Engine** | The core of the product. Takes your server-verified activity plus a target role and computes a deterministic readiness score with a pillar breakdown (foundations, DSA, consistency, proof) and the highest-impact next moves. |
| 💻 | **DSA Arena** | A LeetCode-style editor (Monaco) with multi-language compile and run, hidden test cases, and runtime and memory feedback. A problem only counts once the judge actually accepts it. |
| 🧭 | **Opportunities** | Open-source programs and jobs (GSoC, LFX, Outreachy, internships) with live Open, Closed, or Rolling status scraped from the source pages. |
| 🗺️ | **Roadmaps** | Interactive, expandable graph roadmaps across frontend, backend, data, DevOps and more, with free resources mapped to every node. |
| 🤖 | **AI Advisor** | A chat advisor with persistent history for the softer questions a score cannot answer. |
| ⚡ | **Compiler** | A standalone online compiler for quick throwaway code. |

## Why it is different

The whole product falls apart the moment the readiness number can be nudged, so I designed it to be impossible to game.

- **Trust the judge, not the user.** A problem contributes to your score only after the execution backend returns *accepted*. The client cannot self-report progress.
- **The score is a pure function of evidence.** The readiness engine lives in `src/lib/readiness.ts` with no network calls and no AI. The same evidence always produces the same score, so it is testable, honest, and never silently breaks.
- **Live data, not stale bookmarks.** Opportunity statuses are scraped from the real source pages, so you are not applying to something that closed two weeks ago.

## Tech stack

I stayed deliberately boring where it mattered and modern where it paid off.

| Layer | Choice |
| :--- | :--- |
| Framework | TanStack Start (React 19, SSR, file-based routing) |
| Build | Vite 7 |
| Language | TypeScript, strict mode |
| Styling | Tailwind CSS v4 + shadcn/ui, monochrome dark theme |
| Backend | Supabase (Postgres, Auth, Row-Level Security) |
| Code execution | External sandbox judge API |
| Scraping | Firecrawl for live opportunity status |
| AI | Model gateway with a Google Gemini fallback |
| Editor | Monaco |

Server logic runs through TanStack `createServerFn` with a couple of public API routes for webhooks and cron. There is no separate backend service to babysit.

## Architecture notes

A few decisions worth calling out, the parts I would defend in a review:

- **Readiness is pure and deterministic.** No network, no AI. The score is a function of evidence, nothing else. That makes it trustworthy, which is the entire point.
- **Server functions over an API layer.** Anything touching the database or secrets runs server-side; the client only ever holds the publishable key, and RLS is on for every table.
- **SSR-safe by default.** Browser-only work (the editor, storage reads) is kept out of module scope so the prerender and build steps do not fall over.

## Project structure

```text
src/
├── components/        UI + shadcn primitives, sidebar, editor, roadmap graph
├── data/              static datasets (problems, roadmaps, opportunities)
├── integrations/
│   └── supabase/      generated clients (do not hand-edit)
├── lib/               server functions + core logic
│   ├── readiness.ts   the deterministic readiness engine
│   ├── judge.*        code execution
│   ├── ai.server.ts   AI gateway
│   └── firecrawl.server.ts
├── routes/            file-based routes (pages + api)
│   ├── __root.tsx     app shell
│   ├── _authenticated/ gated routes (readiness, advisor)
│   └── api/           webhooks / cron / chat
└── styles.css         Tailwind v4 theme + tokens
supabase/migrations/   database schema
```

## Running it locally

Requires **Bun >= 1.0** (Node 20+ works too) and **Git**.

```bash
git clone https://github.com/ezvor/ezvor.git
cd ezvor
bun install
bun run dev
```

The app comes up on http://localhost:8080.

### Environment

Create a `.env` in the project root:

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

A few notes:

- `VITE_*` values are exposed to the browser, so keep them public-safe.
- Server secrets are read via `process.env` inside server functions. Never prefix them with `VITE_`.
- Grab a free Gemini key from https://aistudio.google.com/apikey and a Firecrawl key from https://firecrawl.dev.

## Scripts

| Command | What it does |
| :--- | :--- |
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Production build |
| `bun run build:dev` | Dev-mode build (useful for debugging SSR) |
| `bun run preview` | Preview a production build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |

## Database

Postgres via Supabase. The schema lives in `supabase/migrations/`. If you are self-hosting against your own project, run the migrations and regenerate the types in `src/integrations/supabase/`. Every public table has RLS enabled and the app assumes it.

## Deployment

Ezvor is server-rendered, so it needs a host that runs server functions. A static host will not work. It is currently deployed at https://ezvor.lovable.app. Any platform that supports Node or edge SSR (Vercel, Netlify, and similar) works: connect the repo, set the environment variables above, and deploy.

## Roadmap

Things I still want to build:

- Broaden the opportunity sources and add filtering by region and eligibility
- Per-user consistency streaks feeding the readiness "consistency" pillar more granularly
- Shareable readiness reports
- More languages in the judge

## License

Open source. Add a `LICENSE` file (MIT is a fine default) if you plan to reuse it.

<div align="center">

<br />

**[Ezvor](https://ezvor.lovable.app)** · Built for engineers who want the truth about where they stand.

</div>
