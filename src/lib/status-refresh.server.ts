// Server-only engine that verifies opportunity application statuses against
// their official pages, then records the verdict + a citation and logs changes.
//
//   read   scrapePage(): Firecrawl (if keyed) → Jina Reader (keyless) → direct fetch
//   judge  AI verdict from the page text, with a keyword + date heuristic when
//          AI is unavailable or slow
//   store  Supabase (opportunity_status / opportunity_status_log) when the
//          service-role key is configured, plus an in-memory copy that makes the
//          feature work with no database at all
//
// The static `status` in careerData is always the baseline.

import { aiJSON, type ChatMessage } from "./ai.server";
import { scrapePage, type ScrapedPage } from "./web.server";
import { OPPORTUNITIES, type Opportunity, type OppStatus } from "@/data/careerData";
import { isAdminConfigured } from "@/integrations/supabase/client.server";

export type Confidence = "High" | "Medium" | "Low";

export interface StatusVerdict {
  status: OppStatus;
  statusNote: string;
  reason: string;
  confidence: Confidence;
  sourceUrl: string;
  sourceTitle?: string;
  method: "ai" | "heuristic";
}

export interface StatusRecord {
  oppId: string;
  status: string;
  statusNote: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  reason: string | null;
  confidence: string | null;
  checkedAt: string;
}

export interface StatusChange {
  opp_id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  source_url: string | null;
  changed_at: string;
}

const STATUSES: OppStatus[] = ["Open", "Closed", "Upcoming", "Rolling"];

/* ------------------------------------------------------------- storage */

const memory = new Map<string, StatusRecord>();
const memoryLog: StatusChange[] = [];

async function admin() {
  if (!isAdminConfigured()) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Every known live status (database + this instance's memory, newest wins). */
export async function readStatuses(): Promise<StatusRecord[]> {
  const merged = new Map<string, StatusRecord>();
  const db = await admin();
  if (db) {
    const { data, error } = await db
      .from("opportunity_status")
      .select(
        "opp_id, status, status_note, source_url, source_title, reason, confidence, checked_at",
      );
    if (error) console.warn("[status] read failed", error.message);
    for (const r of data ?? []) {
      merged.set(r.opp_id, {
        oppId: r.opp_id,
        status: r.status,
        statusNote: r.status_note,
        sourceUrl: r.source_url,
        sourceTitle: r.source_title,
        reason: r.reason,
        confidence: r.confidence,
        checkedAt: r.checked_at,
      });
    }
  }
  for (const [id, rec] of memory) {
    const cur = merged.get(id);
    if (!cur || Date.parse(rec.checkedAt) > Date.parse(cur.checkedAt)) merged.set(id, rec);
  }
  return [...merged.values()];
}

/** Recent status changes (database + memory). */
export async function readChangeLog(limit = 15): Promise<StatusChange[]> {
  let rows: StatusChange[] = [];
  const db = await admin();
  if (db) {
    const { data, error } = await db
      .from("opportunity_status_log")
      .select("opp_id, old_status, new_status, reason, source_url, changed_at")
      .order("changed_at", { ascending: false })
      .limit(limit);
    if (error) console.warn("[status] log read failed", error.message);
    rows = (data ?? []) as StatusChange[];
  }
  const seen = new Set(rows.map((r) => `${r.opp_id}|${r.changed_at}`));
  for (const r of memoryLog) if (!seen.has(`${r.opp_id}|${r.changed_at}`)) rows.push(r);
  return rows.sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at)).slice(0, limit);
}

async function currentStatus(opp: Opportunity): Promise<string | null> {
  const mem = memory.get(opp.id);
  if (mem) return mem.status;
  const db = await admin();
  if (db) {
    const { data } = await db
      .from("opportunity_status")
      .select("status")
      .eq("opp_id", opp.id)
      .maybeSingle();
    if (data?.status) return data.status;
  }
  return opp.status ?? null;
}

/** Record a verdict and append a change-log row when the status changed. */
async function persist(opp: Opportunity, verdict: StatusVerdict) {
  const oldStatus = await currentStatus(opp);
  const now = new Date().toISOString();
  const record: StatusRecord = {
    oppId: opp.id,
    status: verdict.status,
    statusNote: verdict.statusNote,
    sourceUrl: verdict.sourceUrl,
    sourceTitle: verdict.sourceTitle ?? null,
    reason: verdict.reason,
    confidence: verdict.confidence,
    checkedAt: now,
  };
  memory.set(opp.id, record);

  const changed = oldStatus !== verdict.status;
  if (changed) {
    memoryLog.unshift({
      opp_id: opp.id,
      old_status: oldStatus,
      new_status: verdict.status,
      reason: verdict.reason,
      source_url: verdict.sourceUrl,
      changed_at: now,
    });
    memoryLog.length = Math.min(memoryLog.length, 50);
  }

  const db = await admin();
  if (db) {
    try {
      await db.from("opportunity_status").upsert({
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
      if (changed) {
        await db.from("opportunity_status_log").insert({
          opp_id: opp.id,
          old_status: oldStatus,
          new_status: verdict.status,
          reason: verdict.reason,
          source_url: verdict.sourceUrl,
        });
      }
    } catch (e) {
      console.warn(`[status] persist ${opp.id} failed`, e);
    }
  }
  return { changed, oldStatus, checkedAt: now };
}

/* ----------------------------------------------------------- heuristic */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

type FoundDate = { at: number; index: number; text: string };

function findDates(text: string, today: Date): FoundDate[] {
  const out: FoundDate[] = [];
  const push = (y: number, m: number, d: number, index: number, raw: string) => {
    if (m < 0 || m > 11 || d < 1 || d > 31 || y < 2000 || y > 2100) return;
    out.push({ at: Date.UTC(y, m, d, 23, 59), index, text: raw });
  };
  const month = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase());
  let m: RegExpExecArray | null;

  // 12 April 2026 / 12th Apr, 2026
  const dmy = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\.?,?\\s+(\\d{4})\\b`,
    "gi",
  );
  while ((m = dmy.exec(text))) push(+m[3], month(m[2]), +m[1], m.index, m[0]);
  // April 12, 2026
  const mdy = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi");
  while ((m = mdy.exec(text))) push(+m[3], month(m[1]), +m[2], m.index, m[0]);
  // 2026-04-12
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
  while ((m = iso.exec(text))) push(+m[1], +m[2] - 1, +m[3], m.index, m[0]);
  // "April 12" without a year → assume the nearest upcoming occurrence is this year.
  const md = new RegExp(
    `\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!,?\\s*\\d{4})`,
    "gi",
  );
  while ((m = md.exec(text))) push(today.getUTCFullYear(), month(m[1]), +m[2], m.index, m[0]);
  return out;
}

const CLOSED =
  /applications? (?:are |is |have |has )?(?:now )?closed|no longer accepting|deadline has passed|registrations? (?:is |are |has )?(?:now )?closed|(?:program|programme|position|cycle|call) (?:is |has )?(?:now )?closed|closed for (?:applications|submissions|\d{4})|submissions? (?:are |is )?closed|we are not currently accepting|not accepting applications/i;
const ROLLING =
  /rolling (?:basis|admissions?|applications?|deadline)|apply (?:at )?any ?time|accept(?:s|ing)? applications (?:all )?year[- ]round|open year[- ]round|no (?:application )?deadline|always open|continuous(?:ly)? (?:open|accepting)/i;
const OPEN =
  /applications? (?:are |is )?(?:now )?open|apply now|now accepting|accepting applications|registrations? (?:are |is )?(?:now )?open|submit your application|start (?:your|an) application|register now|sign up now/i;
const UPCOMING =
  /applications? (?:will )?open (?:on|in)|opens? (?:on|in) (?:early |late |mid-?)?[a-z]+|coming soon|stay tuned|next (?:cycle|cohort|edition)|notify me|get notified|sign up for updates|join the (?:wait ?list|mailing list)/i;
const DEADLINE_WORDS =
  /deadline|close[sd]?|closing|apply by|due|last date|until|ends?|submissions?/i;
const OPENING_WORDS = /open(?:s|ing)?\b|launch|begin|start/i;

function around(text: string, index: number, span = 90): string {
  const start = Math.max(0, index - span);
  const end = Math.min(text.length, index + span);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

function fmtDate(at: number): string {
  return new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Keyword + date verdict. Returns null when the page has no usable signal. */
export function heuristicVerdict(
  opp: Opportunity,
  page: ScrapedPage,
  now = new Date(),
): StatusVerdict | null {
  const text = `${page.summary ?? ""}\n${page.markdown ?? ""}`.slice(0, 30_000);
  if (text.trim().length < 40) return null;
  const today = now.getTime();
  const base = { sourceUrl: opp.url, sourceTitle: page.title, method: "heuristic" as const };

  // Classify each date by the keyword closest before it ("close by 6 July …
  // launches on 22 July" → 6 July is the deadline, 22 July an opening).
  const kindOf = (d: FoundDate): "deadline" | "opening" | null => {
    const before = text.slice(Math.max(0, d.index - 70), d.index).toLowerCase();
    const last = (re: RegExp) => {
      let pos = -1;
      for (const m of before.matchAll(new RegExp(re.source, "gi"))) pos = m.index ?? pos;
      return pos;
    };
    const dl = last(DEADLINE_WORDS);
    const op = last(OPENING_WORDS);
    if (dl < 0 && op < 0) return null;
    return dl >= op ? "deadline" : "opening";
  };
  const dates = findDates(text, now);
  const deadlines = dates.filter((d) => kindOf(d) === "deadline");
  const openings = dates.filter((d) => kindOf(d) === "opening");
  const futureDeadline = deadlines.filter((d) => d.at >= today).sort((a, b) => a.at - b.at)[0];
  const pastDeadline = deadlines.filter((d) => d.at < today).sort((a, b) => b.at - a.at)[0];
  const futureOpening = openings.filter((d) => d.at > today).sort((a, b) => a.at - b.at)[0];

  const closed = CLOSED.exec(text);
  const rolling = ROLLING.exec(text);
  const open = OPEN.exec(text);
  const upcoming = UPCOMING.exec(text);

  if (closed && futureOpening) {
    return {
      ...base,
      status: "Upcoming",
      confidence: "Medium",
      statusNote: `Opens ${fmtDate(futureOpening.at)}`,
      reason: around(text, futureOpening.index),
    };
  }
  if (closed && !futureDeadline) {
    return {
      ...base,
      status: "Closed",
      confidence: "Medium",
      statusNote: "Applications closed",
      reason: around(text, closed.index),
    };
  }
  if (futureDeadline && (open || !upcoming || !futureOpening)) {
    return {
      ...base,
      status: "Open",
      confidence: open ? "Medium" : "Low",
      statusNote: `Deadline ${fmtDate(futureDeadline.at)}`,
      reason: around(text, futureDeadline.index),
    };
  }
  if (futureOpening || upcoming) {
    const idx = futureOpening?.index ?? upcoming!.index;
    return {
      ...base,
      status: "Upcoming",
      confidence: futureOpening ? "Medium" : "Low",
      statusNote: futureOpening
        ? `Opens ${fmtDate(futureOpening.at)}`
        : "Next cycle announced soon",
      reason: around(text, idx),
    };
  }
  if (rolling) {
    return {
      ...base,
      status: "Rolling",
      confidence: "Medium",
      statusNote: "Rolling applications",
      reason: around(text, rolling.index),
    };
  }
  if (open) {
    return {
      ...base,
      status: opp.status === "Rolling" ? "Rolling" : "Open",
      confidence: "Low",
      statusNote: "Applications open",
      reason: around(text, open.index),
    };
  }
  if (pastDeadline) {
    return {
      ...base,
      status: "Closed",
      confidence: "Low",
      statusNote: `Closed ${fmtDate(pastDeadline.at)}`,
      reason: around(text, pastDeadline.index),
    };
  }
  return null;
}

/* ----------------------------------------------------------------- AI */

/** Lines that mention dates or status keywords, so small models see the evidence first. */
function keyLines(text: string): string {
  const lines = text.split("\n").filter((l) => l.trim().length > 3);
  const re = new RegExp(
    `${MONTH_RE}|\\b20\\d{2}\\b|deadline|apply|application|registration|closed|open|rolling|cohort|cycle`,
    "i",
  );
  return lines
    .filter((l) => re.test(l))
    .slice(0, 40)
    .map((l) => l.slice(0, 240))
    .join("\n");
}

const VERDICT_SCHEMA = {
  name: "report_status",
  description: "Report the verified application status of a program from its official page.",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: STATUSES,
        description:
          "Open = accepting applications now with a future deadline. Closed = deadline passed / cycle over. Upcoming = announced, not yet accepting. Rolling = continuously accepting, no single deadline.",
      },
      statusNote: {
        type: "string",
        description: "Short note, e.g. 'Applications close 12 Apr 2026'. Max ~90 chars.",
      },
      reason: {
        type: "string",
        description:
          "1-2 sentences of evidence quoted from the page (dates / phrases) that justify the status.",
      },
      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
    },
    required: ["status", "statusNote", "reason", "confidence"],
  },
};

async function aiVerdict(opp: Opportunity, page: ScrapedPage): Promise<StatusVerdict | null> {
  const md = page.markdown ?? "";
  const content = [
    page.summary ? `SUMMARY:\n${page.summary}` : "",
    `KEY LINES:\n${keyLines(md)}`,
    `PAGE START:\n${md.slice(0, 3500)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (content.length < 80) return null;

  const today = new Date().toISOString().slice(0, 10);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You verify the live application status of tech opportunities strictly from the official page text provided. Never guess beyond the text. Compare every date with today's date. If the page lacks clear dates, lower the confidence. Always cite concrete evidence in `reason`.",
    },
    {
      role: "user",
      content: `Today's date: ${today}\nProgram: ${opp.title} by ${opp.org}\nOfficial page: ${opp.url}\nPreviously recorded status: ${opp.status ?? "unknown"}\n\n--- OFFICIAL PAGE ---\n${content}`,
    },
  ];

  try {
    const raw = await aiJSON<{
      status?: string;
      statusNote?: string;
      reason?: string;
      confidence?: string;
    }>(messages, VERDICT_SCHEMA, { tier: "fast", timeoutMs: 20_000 });
    const status = STATUSES.find((s) => s.toLowerCase() === String(raw.status ?? "").toLowerCase());
    if (!status) return null;
    const confidence =
      (["High", "Medium", "Low"] as const).find((c) => c === raw.confidence) ?? "Low";
    return {
      status,
      statusNote: String(raw.statusNote ?? "")
        .trim()
        .slice(0, 120),
      reason:
        String(raw.reason ?? "")
          .trim()
          .slice(0, 400) || "Based on the official page.",
      confidence,
      sourceUrl: opp.url,
      sourceTitle: page.title,
      method: "ai",
    };
  } catch (e) {
    console.warn(`[status] AI verdict failed for ${opp.id}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

function deadline<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

/** Read the official page and decide its status (AI first, heuristic fallback). */
async function verify(opp: Opportunity, aiBudgetMs = 25_000): Promise<StatusVerdict | null> {
  const page = await scrapePage(opp.url);
  const ai = await deadline(aiVerdict(opp, page), aiBudgetMs, null);
  if (ai) return ai;
  return heuristicVerdict(opp, page);
}

/* ------------------------------------------------------------- public */

export interface RecheckResult {
  oppId: string;
  status: string;
  statusNote: string | null;
  reason: string | null;
  confidence: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  checkedAt: string;
  changed: boolean;
  oldStatus: string | null;
  method: "ai" | "heuristic" | "cached";
}

const RECHECK_COOLDOWN_MS = 5 * 60_000;
const STALE_AFTER_MS = 20 * 3600_000;

/** Re-check a single opportunity on demand (used by the UI button). */
export async function recheckOne(oppId: string): Promise<RecheckResult> {
  const opp = OPPORTUNITIES.find((o) => o.id === oppId);
  if (!opp) throw new Error("Unknown opportunity");

  // Someone just checked this one — reuse the fresh verdict.
  const recent = memory.get(opp.id);
  if (recent && Date.now() - Date.parse(recent.checkedAt) < RECHECK_COOLDOWN_MS) {
    return { ...recent, changed: false, oldStatus: recent.status, method: "cached" };
  }

  let verdict: StatusVerdict | null;
  try {
    verdict = await verify(opp);
  } catch {
    throw new Error("Couldn't reach the official page right now. Try again in a minute.");
  }
  if (!verdict) {
    throw new Error(
      "The official page doesn't state a clear status. Open it to check the dates yourself.",
    );
  }

  const { changed, oldStatus, checkedAt } = await persist(opp, verdict);
  return {
    oppId,
    status: verdict.status,
    statusNote: verdict.statusNote,
    reason: verdict.reason,
    confidence: verdict.confidence,
    sourceUrl: verdict.sourceUrl,
    sourceTitle: verdict.sourceTitle ?? null,
    checkedAt,
    changed,
    oldStatus,
    method: verdict.method,
  };
}

export interface RefreshSummary {
  checked: number;
  updated: number;
  changed: number;
  failed: number;
  /** Trackable opportunities not verified in the last 20 hours. */
  remaining: number;
  ms: number;
  changes: { oppId: string; title: string; from: string | null; to: string; method: string }[];
}

/**
 * Re-check a bounded batch of opportunities, least-recently-checked first, so
 * each scheduled run finishes well inside a 60s serverless limit. Repeated
 * runs rotate through the whole list.
 */
export async function refreshStatuses(
  opts: { limit?: number; budgetMs?: number; ids?: string[] } = {},
): Promise<RefreshSummary> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 45_000;
  const limit = Math.max(1, Math.min(opts.limit ?? 8, 25));

  const trackable = OPPORTUNITIES.filter((o) => o.status && (!opts.ids || opts.ids.includes(o.id)));
  const checkedAt = new Map(
    (await readStatuses()).map((s) => [s.oppId, Date.parse(s.checkedAt) || 0]),
  );
  const queue = [...trackable]
    .sort((a, b) => (checkedAt.get(a.id) ?? 0) - (checkedAt.get(b.id) ?? 0))
    .slice(0, limit);

  let updated = 0;
  let failed = 0;
  let attempted = 0;
  const changes: RefreshSummary["changes"] = [];

  const worker = async () => {
    while (queue.length) {
      const elapsed = Date.now() - started;
      // Each check needs up to ~30s (page read + AI); don't start one we can't finish.
      if (elapsed > budget - 28_000) return;
      const opp = queue.shift()!;
      attempted++;
      try {
        const remainingMs = budget - (Date.now() - started);
        const verdict = await deadline(
          verify(opp, Math.min(20_000, remainingMs - 8_000)),
          remainingMs,
          null,
        );
        if (!verdict) {
          failed++;
          continue;
        }
        const res = await persist(opp, verdict);
        checkedAt.set(opp.id, Date.now());
        updated++;
        if (res.changed) {
          changes.push({
            oppId: opp.id,
            title: opp.title,
            from: res.oldStatus,
            to: verdict.status,
            method: verdict.method,
          });
        }
      } catch (e) {
        failed++;
        console.warn(`[status] refresh failed for ${opp.id}:`, e instanceof Error ? e.message : e);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));

  return {
    checked: attempted,
    updated,
    changed: changes.length,
    failed,
    remaining: trackable.filter((o) => Date.now() - (checkedAt.get(o.id) ?? 0) > STALE_AFTER_MS)
      .length,
    ms: Date.now() - started,
    changes,
  };
}
