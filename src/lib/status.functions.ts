// Client-callable server functions for live opportunity statuses + citations.
// Works with or without a database (see status-refresh.server.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RecheckResult, StatusChange, StatusRecord } from "./status-refresh.server";

export type LiveStatus = StatusRecord;
export type { RecheckResult, StatusChange };

/** All known live statuses (public, read-only). */
export const getLiveStatuses = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ statuses: LiveStatus[] }> => {
    const { readStatuses } = await import("./status-refresh.server");
    try {
      return { statuses: await readStatuses() };
    } catch (e) {
      console.error("getLiveStatuses error", e);
      return { statuses: [] };
    }
  },
);

/** Recent status-change history. */
export const getStatusChangeLog = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ changes: StatusChange[] }> => {
    const { readChangeLog } = await import("./status-refresh.server");
    try {
      return { changes: await readChangeLog(15) };
    } catch (e) {
      console.error("getStatusChangeLog error", e);
      return { changes: [] };
    }
  },
);

/** Re-verify a single opportunity now against its official page. */
export const recheckStatus = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(z.object({ oppId: z.string().min(1).max(64) }))
  .handler(async ({ data, context }): Promise<RecheckResult> => {
    const [{ enforceRateLimit }, { recheckOne }] = await Promise.all([
      import("./rate-limit.server"),
      import("./status-refresh.server"),
    ]);
    enforceRateLimit("search", { userId: context.userId as string | null });
    try {
      return await recheckOne(data.oppId);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Re-check failed");
    }
  });
