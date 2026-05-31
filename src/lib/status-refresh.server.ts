// Server-only engine that verifies opportunity application statuses against the
// official source pages (scraped with Firecrawl) and an AI judgement, then
// persists the verdict + a citation and logs any change.
import { callAI, type ChatMessage } from "./ai.server";
import { scrapePage, batchScrapePages, type ScrapedPage } from "./firecrawl.server";
import { OPPORTUNITIES, type Opportunity, type OppStatus } from "@/data/careerData";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface StatusVerdict {
  status: OppStatus;
  statusNote: string;
  reason: string;
  confidence: "High" | "Medium" | "Low";
  sourceUrl: string;
  sourceTitle?: string;
}

interface ToolCallResult {
  choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
}

const verdictTool = [
  {
    type: "function",
    function: {
      name: "report_status",
      description: "Report the verified application status of a program from its official page.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["Open", "Closed", "Upcoming", "Rolling"],
            description:
              "Open = applications currently accepted with a future deadline. Closed = deadline passed / cycle over. Upcoming = announced for a future cycle, not yet accepting. Rolling = continuously / always accepting with no single deadline.",
          },
          statusNote: {
            type: "string",
            description: "Short human note, e.g. 'Applications close 12 Apr 2026' or 'Next cycle expected Feb'. Max ~90 chars.",
          },
          reason: {
            type: "string",
            description:
              "1-2 sentences of evidence pulled directly from the page (quote dates/phrases) that justify the status. This is shown to users as the citation rationale.",
          },
          confidence: { type: "string", enum: ["High", "Medium", "Low"] },
        },
        required: ["status", "statusNote", "reason", "confidence"],
        additionalProperties: false,
      },
    },
  },
];

function buildContent(page: ScrapedPage): string {
  const md = (page.markdown ?? "").slice(0, 6000);
  return [page.summary ? `SUMMARY:\n${page.summary}` : "", md ? `PAGE CONTENT:\n${md}` : ""]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

/** Ask the AI to judge status from already-scraped page content. */
async function judge(opp: Opportunity, page: ScrapedPage): Promise<StatusVerdict | null> {
  const content = buildContent(page);
  if (!content) return null;

  const today = new Date().toISOString().slice(0, 10);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You verify the live application status of tech opportunities strictly from the official page text provided. Never guess beyond the text. If the page lacks clear dates, lower the confidence. Always cite concrete evidence (dates, phrases) in `reason`.",
    },
    {
      role: "user",
      content: `Today's date: ${today}\nProgram: ${opp.title} by ${opp.org}\nOfficial page: ${opp.url}\nCurrent recorded status: ${opp.status ?? "unknown"}\n\n--- OFFICIAL PAGE ---\n${content}`,
    },
  ];

  const res = await callAI(messages, {
    tools: verdictTool,
    tool_choice: { type: "function", function: { name: "report_status" } },
  });
  if (!res.ok) {
    console.error(`AI status judge failed for ${opp.id}: ${res.status}`);
    return null;
  }
  const data = (await res.json()) as ToolCallResult;
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    const parsed = JSON.parse(args) as Omit<StatusVerdict, "sourceUrl" | "sourceTitle">;
    return { ...parsed, sourceUrl: opp.url, sourceTitle: page.title };
  } catch {
    return null;
  }
}

/** Persist a verdict and append a change-log row when the status changed. */
async function persist(opp: Opportunity, verdict: StatusVerdict) {
  const { data: existing } = await supabaseAdmin
    .from("opportunity_status")
    .select("status")
    .eq("opp_id", opp.id)
    .maybeSingle();

  const oldStatus = existing?.status ?? opp.status ?? null;
  const now = new Date().toISOString();

  await supabaseAdmin.from("opportunity_status").upsert({
    opp_id: opp.id,
    status: verdict.status,
    status_note: verdict.statusNote,
    source_url: verdict.sourceUrl,
    source_title: verdict.sourceTitle ?? null,
    reason: verdict.reason,
    confidence: verdict.confidence,
    checked_at: now,
    updated_at: now,
  });

  const changed = oldStatus !== verdict.status;
  if (changed) {
    await supabaseAdmin.from("opportunity_status_log").insert({
      opp_id: opp.id,
      old_status: oldStatus,
      new_status: verdict.status,
      reason: verdict.reason,
      source_url: verdict.sourceUrl,
    });
  }
  return { changed, oldStatus };
}

/** Re-check a single opportunity on demand (used by the UI button). */
export async function recheckOne(oppId: string) {
  const opp = OPPORTUNITIES.find((o) => o.id === oppId);
  if (!opp) throw new Error("Unknown opportunity");

  const page = await scrapePage(opp.url);
  const verdict = await judge(opp, page);
  if (!verdict) throw new Error("Could not verify status from the official page");

  const { changed, oldStatus } = await persist(opp, verdict);
  return {
    oppId,
    status: verdict.status,
    statusNote: verdict.statusNote,
    reason: verdict.reason,
    confidence: verdict.confidence,
    sourceUrl: verdict.sourceUrl,
    sourceTitle: verdict.sourceTitle ?? null,
    checkedAt: new Date().toISOString(),
    changed,
    oldStatus,
  };
}

async function chunked<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    out.push(...(await Promise.all(batch.map(fn))));
  }
  return out;
}

export interface RefreshSummary {
  checked: number;
  updated: number;
  changed: number;
  changes: { oppId: string; title: string; from: string | null; to: string }[];
}

/** Re-check every trackable opportunity. Called by the scheduled cron route. */
export async function refreshAllStatuses(limit?: number): Promise<RefreshSummary> {
  const trackable = OPPORTUNITIES.filter((o) => o.status);
  const targets = limit ? trackable.slice(0, limit) : trackable;

  // One batch scrape for all official pages.
  let pages = new Map<string, ScrapedPage>();
  try {
    pages = await batchScrapePages(targets.map((o) => o.url));
  } catch (e) {
    console.error("Batch scrape failed, falling back to per-page", e);
  }

  let updated = 0;
  const changes: RefreshSummary["changes"] = [];

  await chunked(targets, 4, async (opp) => {
    try {
      let page = pages.get(opp.url);
      if (!page) page = await scrapePage(opp.url);
      const verdict = await judge(opp, page);
      if (!verdict) return;
      const { changed, oldStatus } = await persist(opp, verdict);
      updated += 1;
      if (changed) changes.push({ oppId: opp.id, title: opp.title, from: oldStatus, to: verdict.status });
    } catch (e) {
      console.error(`Refresh failed for ${opp.id}`, e);
    }
  });

  return { checked: targets.length, updated, changed: changes.length, changes };
}
