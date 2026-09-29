// Scheduled endpoint (Vercel Cron, daily) that refreshes opportunity statuses
// from their official pages and logs what changed. Lives under /api/public/*
// so it bypasses published-site auth; it performs no destructive user actions
// and returns no PII.
//
// Auth (any one of):
//   Authorization: Bearer <CRON_SECRET | STATUS_REFRESH_SECRET>   (Vercel Cron sends CRON_SECRET)
//   x-cron-secret / x-refresh-secret: <secret>
//   ?secret=<secret>
//
// Each run checks a bounded batch (least recently verified first) inside a
// ~45s budget, so it fits a 60s function limit. Tune with ?limit=1-25 (or a
// JSON body {"limit": n}); repeated runs rotate through every opportunity.
import { createFileRoute } from "@tanstack/react-router";

import { refreshStatuses } from "@/lib/status-refresh.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(request: Request, url: URL): boolean {
  const secrets = [process.env.CRON_SECRET, process.env.STATUS_REFRESH_SECRET]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s);
  if (!secrets.length) return false;
  const provided = [
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim(),
    request.headers.get("x-cron-secret")?.trim(),
    request.headers.get("x-refresh-secret")?.trim(),
    url.searchParams.get("secret")?.trim(),
  ].filter((s): s is string => !!s);
  return provided.some((p) => secrets.some((s) => safeEqual(p, s)));
}

async function run(request: Request) {
  const url = new URL(request.url);
  // Runs web reads + AI calls, so only the scheduler (or an operator) may call it.
  if (!authorized(request, url)) return json({ error: "Unauthorized" }, 401);

  let limit = Number(url.searchParams.get("limit")) || undefined;
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { limit?: number };
      if (typeof body?.limit === "number" && body.limit > 0) limit = body.limit;
    } catch {
      // no body / not JSON — use the default batch size
    }
  }
  const ids = url.searchParams
    .get("ids")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const summary = await refreshStatuses({
    limit: limit ? Math.min(Math.max(1, Math.floor(limit)), 25) : undefined,
    ids: ids?.length ? ids : undefined,
  });
  console.log("Status refresh complete", {
    checked: summary.checked,
    updated: summary.updated,
    changed: summary.changed,
    failed: summary.failed,
    ms: summary.ms,
  });
  return json({ success: true, ...summary });
}

export const Route = createFileRoute("/api/public/hooks/refresh-statuses")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});
