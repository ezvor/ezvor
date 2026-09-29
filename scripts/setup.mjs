#!/usr/bin/env node
// Interactive first-time setup: writes/updates .env and verifies the keys.
//   npm run setup
// Every answer is optional — press Enter to skip. Existing values are kept.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ENV = ".env";
const rl = createInterface({ input: stdin, output: stdout });

function parseEnv(text) {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out.set(m[1], m[2].replace(/^["']|["']$/g, "").replace(/\s+#.*$/, ""));
  }
  return out;
}

const env = parseEnv(existsSync(ENV) ? readFileSync(ENV, "utf8") : "");

async function ask(key, label, hint) {
  const current = env.get(key);
  const shown = current ? ` [keep ${current.slice(0, 6)}…]` : "";
  if (hint) console.log(`  ${hint}`);
  const answer = (await rl.question(`${label}${shown}: `)).trim();
  if (answer) env.set(key, answer);
}

async function checkGemini(key) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=5&key=${encodeURIComponent(key)}`,
    );
    return res.ok ? "ok" : `HTTP ${res.status}`;
  } catch (e) {
    return e.message;
  }
}

async function checkBearer(url, key) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    return res.ok ? "ok" : `HTTP ${res.status}`;
  } catch (e) {
    return e.message;
  }
}

console.log("\nEzvor setup — press Enter to skip any step.\n");

console.log("1) AI (free). Gemini is the primary model; the others are automatic fallbacks.");
await ask("GEMINI_API_KEY", "Gemini API key", "Create one at https://aistudio.google.com/apikey");
await ask("GROQ_API_KEY", "Groq API key (optional)", "https://console.groq.com/keys");
await ask("OPENROUTER_API_KEY", "OpenRouter API key (optional)", "https://openrouter.ai/keys");

console.log("\n2) Accounts + sync (optional, free Supabase project).");
await ask("SUPABASE_URL", "Supabase project URL", "Project Settings → API");
await ask("SUPABASE_PUBLISHABLE_KEY", "Supabase anon/publishable key");
await ask("SUPABASE_SERVICE_ROLE_KEY", "Supabase service_role key (server only)");
if (env.get("SUPABASE_URL")) env.set("VITE_SUPABASE_URL", env.get("SUPABASE_URL"));
if (env.get("SUPABASE_PUBLISHABLE_KEY"))
  env.set("VITE_SUPABASE_PUBLISHABLE_KEY", env.get("SUPABASE_PUBLISHABLE_KEY"));

if (!env.get("VITE_SITE_URL")) env.set("VITE_SITE_URL", "https://qeelo.cloud");
if (!env.get("CRON_SECRET")) {
  env.set(
    "CRON_SECRET",
    [...crypto.getRandomValues(new Uint8Array(24))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  );
}
rl.close();

// Drop old Lovable-only variables if present.
for (const k of ["SUPABASE_PROJECT_ID", "VITE_SUPABASE_PROJECT_ID", "LOVABLE_API_KEY"])
  env.delete(k);

writeFileSync(ENV, [...env].map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
console.log(`\nSaved ${ENV}. Checking keys…`);

if (env.get("GEMINI_API_KEY"))
  console.log(`  Gemini:     ${await checkGemini(env.get("GEMINI_API_KEY"))}`);
if (env.get("GROQ_API_KEY"))
  console.log(
    `  Groq:       ${await checkBearer("https://api.groq.com/openai/v1/models", env.get("GROQ_API_KEY"))}`,
  );
if (env.get("OPENROUTER_API_KEY"))
  console.log(
    `  OpenRouter: ${await checkBearer("https://openrouter.ai/api/v1/key", env.get("OPENROUTER_API_KEY"))}`,
  );
if (env.get("SUPABASE_URL") && env.get("SUPABASE_PUBLISHABLE_KEY")) {
  try {
    const res = await fetch(
      `${env.get("SUPABASE_URL")}/rest/v1/opportunity_status?select=opp_id&limit=1`,
      {
        headers: { apikey: env.get("SUPABASE_PUBLISHABLE_KEY") },
      },
    );
    console.log(
      `  Supabase:   ${res.ok ? "ok" : `HTTP ${res.status} (did you run supabase/migrations/20260928000000_init.sql?)`}`,
    );
  } catch (e) {
    console.log(`  Supabase:   ${e.message}`);
  }
}
console.log(
  "\nDone. Start the app with: npm run dev\nFor production, add the same variables in Vercel → Settings → Environment Variables.\n",
);
