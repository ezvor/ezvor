// Client-callable server functions for live opportunity statuses + citations.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recheckOne } from "@/lib/status-refresh.server";

export interface LiveStatus {
  oppId: string;
  status: string;
  statusNote: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  reason: string | null;
  confidence: string | null;
  checkedAt: string;
}

/** All persisted live statuses (public, read-only). */
export const getLiveStatuses = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("opportunity_status")
    .select("opp_id, status, status_note, source_url, source_title, reason, confidence, checked_at");
  if (error) {
    console.error("getLiveStatuses error", error);
    return { statuses: [] as LiveStatus[] };
  }
  const statuses: LiveStatus[] = (data ?? []).map((r) => ({
    oppId: r.opp_id,
    status: r.status,
    statusNote: r.status_note,
    sourceUrl: r.source_url,
    sourceTitle: r.source_title,
    reason: r.reason,
    confidence: r.confidence,
    checkedAt: r.checked_at,
  }));
  return { statuses };
});

/** Recent status-change history. */
export const getStatusChangeLog = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("opportunity_status_log")
    .select("opp_id, old_status, new_status, reason, source_url, changed_at")
    .order("changed_at", { ascending: false })
    .limit(15);
  if (error) {
    console.error("getStatusChangeLog error", error);
    return { changes: [] };
  }
  return { changes: data ?? [] };
});

/** Re-verify a single opportunity now against its official page. */
export const recheckStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ oppId: z.string().min(1).max(64) }))
  .handler(async ({ data }) => {
    try {
      return await recheckOne(data.oppId);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Re-check failed");
    }
  });
