// Scheduled endpoint (called by pg_cron) that refreshes opportunity statuses
// from their official pages and logs what changed. Lives under /api/public/*
// so it bypasses published-site auth; it performs no destructive user actions
// and returns no PII.
import { createFileRoute } from "@tanstack/react-router";

import { refreshAllStatuses } from "@/lib/status-refresh.server";

async function run(request: Request) {
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
