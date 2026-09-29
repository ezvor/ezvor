<div align="center">

<img src="public/ezvor-banner.png" alt="Ezvor" width="100%" />

<br />

**The career platform that measures real work and tells you the truth: are you hireable yet?**

[Live App](https://qeelo.cloud) · [Report a Bug](https://github.com/ezvor/ezvor/issues) · [Request a Feature](https://github.com/ezvor/ezvor/issues)

</div>

---

## Problems

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

Requires **Node 20+** and **Git**.

```bash
git clone https://github.com/ezvor/ezvor.git
cd ezvor
npm install
npm run dev
```

The app comes up on http://localhost:8080.

### Environment

Copy `.env.example` to `.env`. **Nothing is required**: with no keys the app runs local-first (progress saved in the browser), code runs on free engines (in-browser Python/JS, Wandbox/Paiza for compiled languages) and the AI falls back to a keyless model.

Recommended for production:

- `GEMINI_API_KEY` (free, https://aistudio.google.com/apikey) plus optionally `GROQ_API_KEY` / `OPENROUTER_API_KEY` as automatic fallbacks.
- Your own free Supabase project (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) for accounts, sync, public profiles and the shared problem cache. Run `supabase/migrations/20260928000000_init.sql` once in the SQL editor.
- `CRON_SECRET` for the daily opportunity-status refresh (also keeps a free Supabase project from pausing).

`VITE_*` values are exposed to the browser; never prefix secrets with `VITE_`.

## Scripts

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run build:dev` | Dev-mode build (useful for debugging SSR) |
| `npm run preview` | Preview a production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Database

Postgres via Supabase. The schema lives in `supabase/migrations/`. If you are self-hosting against your own project, run the migrations and regenerate the types in `src/integrations/supabase/`. Every public table has RLS enabled and the app assumes it.

## Deployment

Ezvor is server-rendered, so it needs a host that runs server functions. A static host will not work. It is deployed on Vercel at https://qeelo.cloud (Nitro auto-detects Vercel and Netlify; elsewhere it builds a Node server: `node .output/server/index.mjs`). Import the repo in Vercel, add the environment variables, and point the domain at the project. `vercel.json` schedules the daily status-refresh cron.

## Roadmap

Things I still want to build:

- Broaden the opportunity sources and add filtering by region and eligibility
- Per-user consistency streaks feeding the readiness "consistency" pillar more granularly
- Shareable readiness reports
- More languages in the judge

