# Deploying Ezvor (free tier)

Ezvor runs entirely on free services. Nothing below is mandatory: with zero
configuration the site works in local-first mode (progress saved in each
visitor's browser, free code runners, keyless AI fallback). Each step unlocks
more.

| Piece | Service | Free tier |
| :--- | :--- | :--- |
| Hosting (SSR + server functions) | Vercel Hobby | Yes (Netlify also works) |
| Database, auth, cross-device sync | Supabase | 500 MB DB, 50k MAU |
| AI (coach, editorials, judge generation) | Google Gemini | Free API key |
| AI fallbacks | Groq, OpenRouter, Cerebras, Mistral | Free keys |
| Code execution | In-browser (Python, JS/TS) + Wandbox / Paiza | Keyless |
| Web search / page reading | DuckDuckGo + Jina Reader | Keyless |

## 1. AI key (5 minutes)

1. Open https://aistudio.google.com/apikey and create a key.
2. Optional fallbacks, used automatically when Gemini is rate-limited:
   `GROQ_API_KEY` (https://console.groq.com/keys), `OPENROUTER_API_KEY`.

## 2. Supabase (10 minutes)

1. Create a project at https://supabase.com (any region close to your users).
2. **SQL Editor → New query**, paste `supabase/migrations/20260928000000_init.sql`, **Run**.
3. **Project Settings → API**: copy the Project URL, the `anon`/publishable key and the
   `service_role` key.
4. **Authentication → URL Configuration**: Site URL `https://qeelo.cloud`; add redirect URLs
   `https://qeelo.cloud/**` and `http://localhost:8080/**`.
5. **Authentication → Providers**:
   - Google: create an OAuth client at https://console.cloud.google.com/apis/credentials
     (Web application, authorized redirect URI = the callback URL Supabase shows), paste the
     client ID/secret.
   - GitHub: https://github.com/settings/developers → New OAuth App, callback = the Supabase
     callback URL.

## 3. Vercel

1. https://vercel.com/new → import `ezvor/ezvor`. Framework is detected automatically.
2. **Settings → Environment Variables** (Production + Preview):

   ```
   VITE_SITE_URL=https://qeelo.cloud
   GEMINI_API_KEY=...
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   CRON_SECRET=<any long random string>
   ```

3. Deploy. `vercel.json` registers a daily cron that refreshes opportunity statuses — it also
   keeps a free Supabase project from pausing after a week of inactivity.
4. **Settings → Domains**: add `qeelo.cloud` and `www.qeelo.cloud` (the domain is already on
   Vercel; move it from the placeholder project to this one).

## 4. Netlify (alternative)

Import the repo; `netlify.toml` sets the build. Add the same environment variables. Netlify's
free functions time out sooner, so the first-time AI judge generation for a new problem may
need a retry.

## Local development

```bash
npm install
npm run setup          # interactive: paste your free keys, verifies them, writes .env
npm run dev            # http://localhost:8080
```

`npm run typecheck` and `npm run build` must pass before deploying. Check a running deployment with `GET /api/health` (shows which AI providers and services are active, never secrets).

**Windows note:** if PowerShell says `npm.ps1 cannot be loaded`, use `npm.cmd …` or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
