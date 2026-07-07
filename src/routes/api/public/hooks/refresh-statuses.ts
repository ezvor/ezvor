// Scheduled endpoint (called by pg_cron) that refreshes opportunity statuses
// from their official pages and logs what changed. Lives under /api/public/*
// so it bypasses published-site auth; it performs no destructive user actions
// and returns no PII.
import { createFileRoute } from "@tanstack/react-router";

import { refreshAllStatuses } from "@/lib/status-refresh.server";

async function run(request: Request) {
  // This endpoint runs paid Firecrawl scrapes + AI calls, so it must only be
  // callable by the trusted scheduler. Require a shared secret that only the
  // pg_cron job (or an operator) knows before doing any work.
  const secret = process.env.STATUS_REFRESH_SECRET;
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let limit: number | undefined;
  try {
    const body = (await request.json()) as { limit?: number };
    if (typeof body?.limit === "number" && body.limit > 0) limit = Math.min(body.limit, 50);
  } catch {
    // no body / not JSON — fine, refresh everything
  }

  const started = Date.now();
  const summary = await refreshAllStatuses(limit);
  console.log("Status refresh complete", { ...summary, ms: Date.now() - started });

  return new Response(JSON.stringify({ success: true, ...summary }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/hooks/refresh-statuses")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});
