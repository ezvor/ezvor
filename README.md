# Careera 🚀

**The all-in-one career launchpad for Computer Science students & professionals (built with Pakistani students in mind).**

Careera brings together real-time opportunity tracking, interactive skill roadmaps, a LeetCode-style code playground, curated free resources, and an AI career advisor — all in one place.

🔗 **Live demo:** https://pathcareera.lovable.app
📦 **Repository:** https://github.com/SalmanDeveloperz/careera

---

## ✨ Features

| Feature | Description |
| --- | --- |
| 🎯 **Opportunities** | Real-time open-source & career opportunities (GSoC, LFX, Outreachy, internships, jobs) with **live status** (Open / Closed / Rolling) and **source citations** scraped from official pages so you can verify every status. |
| 🔁 **Auto-refresh job** | A scheduled background job refreshes opportunity statuses and logs what changed. |
| 🗺️ **Roadmaps** | NeetCode-style **interactive, expandable graph roadmaps** across domains: Data Science, DevOps, Data Architect, Frontend, Backend & more. |
| 🧠 **Personalized roadmap** | Generates a tailored roadmap graph based on your current skills and target role, then adapts free resource suggestions. |
| 📺 **Free Resources** | Hand-picked **free** learning resources (YouTube, docs, courses) mapped to each roadmap node. |
| 💻 **Code Playground** | A LeetCode/NeetCode-style editor (Monaco) with multi-language compile & run, hidden test cases, runtime/memory metrics, and solved-status tracking. |
| 🤖 **AI Advisor** | A chat-based career advisor with persistent conversation history. |

---

## 🛠️ Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19 + SSR, file-based routing)
- **Build tool:** Vite 7
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **Animation:** Motion (Framer Motion)
- **Backend:** Lovable Cloud (Supabase — Postgres, Auth, Storage)
- **AI:** Lovable AI Gateway (Google Gemini / OpenAI models)
- **Web scraping:** Firecrawl (live opportunity status + citations)
- **Code execution:** Paiza.io sandbox API (no key required)
- **Editor:** Monaco Editor
- **Charts/Graphs:** Recharts + custom roadmap graph
- **Language:** TypeScript (strict)

---

## 📋 Prerequisites

Make sure you have these installed:

- **[Bun](https://bun.sh)** `>= 1.0` (recommended — the project uses `bun.lock`)
  - Alternatively Node.js `>= 20` + npm works too.
- **Git**
- A code editor (VS Code recommended)

---

## ⚡ Quick Start (Local Setup)

### 1. Clone the repository

```bash
git clone https://github.com/SalmanDeveloperz/careera.git
cd careera
```

### 2. Install dependencies

```bash
bun install
# or, if you prefer npm:
# npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root (see [Environment Variables](#-environment-variables) below):

```bash
cp .env.example .env   # if an example file exists, otherwise create it manually
```

Then fill in your values.

### 4. Start the dev server

```bash
bun run dev
# or: npm run dev
```

The app will be available at **http://localhost:8080** (or the port Vite prints in your terminal).

---

## 🔐 Environment Variables

Create a `.env` file in the project root with the following keys.

### Client + Supabase (required)

```env
# Supabase / Lovable Cloud
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-public-key"
VITE_SUPABASE_PROJECT_ID="your-project-id"

# Same values for SSR / server functions
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-anon-public-key"
```

### Server-only secrets (required for full functionality)

```env
# Service role key — NEVER expose this to the client. Server-side only.
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# --- AI advisor & personalized roadmaps ---
# Pick ONE of the following:
#
# (A) Running INSIDE Lovable: provided automatically — nothing to set.
# LOVABLE_API_KEY is auto-injected on Lovable hosting (*.lovable.app).
#
# (B) Running locally or on Vercel/Netlify: use a FREE Google Gemini key.
# Get one at https://aistudio.google.com/apikey (free tier is generous).
# Same Gemini models = same accuracy you saw inside Lovable.
GEMINI_API_KEY="your-free-google-ai-studio-key"

# Live opportunity scraping + status citations
FIRECRAWL_API_KEY="your-firecrawl-key"
```

> **Notes**
> - `VITE_*` variables are exposed to the browser at build time — only put **public** values there.
> - Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `LOVABLE_API_KEY`, `FIRECRAWL_API_KEY`) are read via `process.env` inside server functions and must **never** be prefixed with `VITE_`.
> - **AI provider is automatic.** `src/lib/ai.server.ts` uses `LOVABLE_API_KEY` when present (inside Lovable), otherwise falls back to `GEMINI_API_KEY` (Google's free OpenAI-compatible Gemini API). So locally/on Vercel you only need to set `GEMINI_API_KEY` — no code changes required.
> - Get a free Gemini key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and a free Firecrawl key at [firecrawl.dev](https://firecrawl.dev).

---

## 📜 Available Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the local dev server with hot reload |
| `bun run build` | Production build |
| `bun run build:dev` | Development-mode build (useful for debugging SSR) |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run ESLint |
| `bun run format` | Format the codebase with Prettier |

---

## 📁 Project Structure

```text
careera/
├── public/                     # Static assets (robots.txt, llms.txt)
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── AppSidebar.tsx      # Main navigation
│   │   ├── CodeEditor.tsx      # Monaco editor wrapper
│   │   ├── RoadmapGraph.tsx    # Interactive roadmap graph
│   │   └── OpportunityCard.tsx # Opportunity card w/ status + citations
│   ├── data/                   # Static datasets
│   │   ├── careerData.ts       # Opportunities & career info
│   │   ├── graphData.ts        # Roadmap graph nodes/edges
│   │   └── problems.ts         # DSA problems for the playground
│   ├── integrations/
│   │   └── supabase/           # Auto-generated Supabase clients (do not edit)
│   ├── lib/                    # Server functions & helpers
│   │   ├── ai.server.ts        # AI gateway calls
│   │   ├── firecrawl.server.ts # Web scraping
│   │   ├── judge.server.ts     # Code execution engine
│   │   ├── judge.functions.ts  # Run/Submit server functions
│   │   ├── status-refresh.server.ts # Opportunity status refresh
│   │   └── chatHistory.ts      # Advisor chat history (localStorage)
│   ├── routes/                 # File-based routes (pages + API)
│   │   ├── __root.tsx          # App shell
│   │   ├── index.tsx           # Home
│   │   ├── opportunities.tsx   # Opportunities page
│   │   ├── roadmaps.tsx        # Roadmaps list
│   │   ├── graph.tsx           # Interactive graph view
│   │   ├── resources.tsx       # Free resources
│   │   ├── playground.tsx      # Code playground
│   │   ├── advisor.tsx         # AI advisor
│   │   └── api/                # Server routes (webhooks, cron, chat)
│   ├── router.tsx              # Router setup
│   └── styles.css              # Tailwind v4 theme + design tokens
├── supabase/                   # Migrations & config
├── vite.config.ts
└── package.json
```

---

## 🗄️ Backend & Database

This project uses **Lovable Cloud** (powered by Supabase) for:

- **Database** — opportunity statuses, change logs
- **Auth** — user authentication (email + Google)
- **Server functions** — AI chat, Firecrawl scraping, code judging

Database schema lives in `supabase/migrations/`. When self-hosting against your own Supabase project, run the migrations against your database, then regenerate `src/integrations/supabase/types.ts`.

---

## 🚀 Deployment

Careera is a **server-side rendered (SSR)** app, so it needs a host that supports Node/edge server functions — a plain static host will not work.

### Option A — Lovable (easiest)

Click **Publish** inside the Lovable editor. AI, scraping, and the database all work out of the box with zero config.

### Option B — Vercel (recommended for self-hosting)

1. Push your code to GitHub (see below).
2. Import the repo into [Vercel](https://vercel.com). It auto-detects the framework.
3. Add all environment variables from the [Environment Variables](#-environment-variables) section in **Project Settings → Environment Variables**.
4. Deploy. ✅

### Option C — Netlify

Similar to Vercel — connect the repo, add the environment variables, and deploy. Vercel tends to have smoother SSR support, so it's preferred.

> ⚠️ **AI on external hosts:** `LOVABLE_API_KEY` only works on Lovable's hosting. On Vercel/Netlify, just add a free `GEMINI_API_KEY` (from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) in your project's environment variables — the code falls back to it automatically. No code changes needed.

---

## 🔗 Pushing to GitHub

The recommended way is **Lovable's native GitHub sync**:

1. In the Lovable editor, click **GitHub** (top-right) → **Connect to GitHub**.
2. Authorize Lovable and select the `SalmanDeveloperz/careera` repository (or create it).
3. Every change you make in Lovable is then automatically committed and pushed.

To push manually from your local clone instead:

```bash
git remote add origin https://github.com/SalmanDeveloperz/careera.git
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m "Add amazing feature"`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please run `bun run lint` and `bun run format` before submitting.

---

## 📄 License

This project is open source. Add a `LICENSE` file (e.g. [MIT](https://choosealicense.com/licenses/mit/)) to define usage terms.

---

## 🙌 Acknowledgements

- Built with [Lovable](https://lovable.dev)
- Roadmap UI inspired by [NeetCode](https://neetcode.io) & [roadmap.sh](https://roadmap.sh)
- Code execution powered by [Paiza.io](https://paiza.io)
- Live data via [Firecrawl](https://firecrawl.dev)

---

<p align="center">Made with ❤️ for CS students & professionals</p>
