import { createFileRoute } from "@tanstack/react-router";

// Deployment health: which optional services are configured (never exposes secrets).
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const [{ aiProviderLabels }, { isAdminConfigured }] = await Promise.all([
          import("@/lib/ai.server"),
          import("@/integrations/supabase/client.server"),
        ]);
        const body = {
          ok: true,
          ai: aiProviderLabels(),
          accounts: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY),
          sharedCache: isAdminConfigured(),
          runners: [
            "browser",
            ...(process.env.PISTON_URL ? ["piston"] : []),
            ...(process.env.JUDGE0_URL ? ["judge0"] : []),
            "wandbox",
            "paiza",
          ],
        };
        return new Response(JSON.stringify(body), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
