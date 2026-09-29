// Cloud sync for signed-in users.
//
// The browser store (./store.ts) is always the working copy. When a user signs
// in we:
//   1. pull their `user_data` documents for the SYNCED collections, merge them
//      with local data, write the result locally (silently) and push it back;
//   2. hydrate local `solved` from the judge-written `solved_problems` rows and
//      fold server submission days into `activity`, so streaks and solved
//      counts follow the user across devices;
//   3. debounce-push further local changes (~1.5 s), re-merging with the cloud
//      copy each time so two open devices don't clobber each other.
//
// Deletions (un-bookmarking, clearing a note) are carried as tombstones in the
// synced document; a per-user "base" snapshot of the last synced keys tells us
// which keys were removed locally.
//
// Everything here is best-effort: failures are logged and swallowed so sync
// can never break the page, and tables missing on older databases are skipped.

import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { LANG_KEYS, type LangKey } from "@/lib/judge/languages";
import {
  DEFAULT_EDITOR_SETTINGS,
  SYNCED,
  dayKey,
  getCollection,
  onLocalChange,
  setCollection,
  type BookmarkEntry,
  type CollectionName,
  type Collections,
  type Difficulty,
  type EditorSettings,
  type NoteEntry,
  type ReviewEntry,
  type SolvedEntry,
} from "./store";

const PUSH_DEBOUNCE_MS = 1500;
const REFRESH_MIN_INTERVAL_MS = 2 * 60_000;
/** Stay well under the table's 512 KB jsonb check. */
const MAX_DOC_CHARS = 400_000;
const TOMBSTONE_TTL_MS = 90 * 86_400_000;
const META_PREFIX = "ezvor:sync:";
const DOC_VERSION = 1;

type RecordName = "notes" | "bookmarks" | "review";
type SyncedName = RecordName | "settings";

type SyncDoc<T> = {
  v: number;
  updatedAt: number;
  data: T;
  deleted?: Record<string, number>;
};

export type SyncStatus = "off" | "syncing" | "synced" | "error";

/* ------------------------------------------------------------ utilities */

const log = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.warn("[sync]", ...args);
};

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    /does not exist|could not find the table/i.test(error.message ?? "")
  );
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
    .join(",")}}`;
}

function readMeta<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(META_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeMeta(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(META_PREFIX + key);
    else window.localStorage.setItem(META_PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Forget sync bookkeeping (used when local data is cleared). */
export function clearSyncState() {
  for (const name of SYNCED) writeMeta(`base:${name}`, null);
  writeMeta("settings-updated", null);
}

const num = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const asDifficulty = (v: unknown): Difficulty => {
  const d = typeof v === "string" ? v.toLowerCase() : "";
  return d.startsWith("e") ? "Easy" : d.startsWith("h") ? "Hard" : "Medium";
};
const asLang = (v: unknown, fallback: LangKey = "python"): LangKey =>
  (LANG_KEYS as readonly string[]).includes(v as string) ? (v as LangKey) : fallback;

/* ------------------------------------------------------- sanitizers */

function sanitizeRecord<T>(
  raw: unknown,
  fix: (slug: string, v: Record<string, unknown>) => T | null,
): Record<string, T> {
  const out: Record<string, T> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [slug, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!slug || slug.length > 200 || !v || typeof v !== "object") continue;
    const fixed = fix(slug, v as Record<string, unknown>);
    if (fixed) out[slug] = fixed;
  }
  return out;
}

const fixNote = (slug: string, v: Record<string, unknown>): NoteEntry | null =>
  typeof v.text === "string" && v.text.trim()
    ? { slug, text: v.text.slice(0, 20_000), updatedAt: num(v.updatedAt) }
    : null;

const fixBookmark = (slug: string, v: Record<string, unknown>): BookmarkEntry => ({
  slug,
  at: num(v.at),
});

const fixReview = (slug: string, v: Record<string, unknown>): ReviewEntry => ({
  slug,
  title: str(v.title) || slug,
  difficulty: asDifficulty(v.difficulty),
  due: num(v.due, Date.now()),
  intervalDays: Math.max(1, num(v.intervalDays, 1)),
  ease: Math.min(5, Math.max(1.3, num(v.ease, 2.5))),
  reps: Math.max(0, Math.floor(num(v.reps))),
  lastReviewed: typeof v.lastReviewed === "number" ? v.lastReviewed : null,
});

function fixSettings(raw: unknown): EditorSettings {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_EDITOR_SETTINGS;
  return {
    fontSize: Math.min(32, Math.max(10, num(v.fontSize, d.fontSize))),
    tabSize: [2, 4, 8].includes(num(v.tabSize)) ? num(v.tabSize) : d.tabSize,
    wordWrap: typeof v.wordWrap === "boolean" ? v.wordWrap : d.wordWrap,
    minimap: typeof v.minimap === "boolean" ? v.minimap : d.minimap,
    theme: v.theme === "light" || v.theme === "vs-dark" ? v.theme : d.theme,
    keybindings:
      v.keybindings === "vim" || v.keybindings === "standard" ? v.keybindings : d.keybindings,
    preferredLanguage: asLang(v.preferredLanguage, d.preferredLanguage),
  };
}

function sanitizeTombstones(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && v > cutoff && k.length <= 200) out[k] = v;
  }
  return out;
}

/* ------------------------------------------------------------ merge rules */

const RECORD_RULES: {
  [K in RecordName]: {
    fix: (slug: string, v: Record<string, unknown>) => Collections[K][string] | null;
    /** Timestamp used against tombstones and for trimming. */
    ts: (e: Collections[K][string]) => number;
    pick: (a: Collections[K][string], b: Collections[K][string]) => Collections[K][string];
  };
} = {
  // Newest edit wins.
  notes: {
    fix: fixNote,
    ts: (e) => e.updatedAt,
    pick: (a, b) => (b.updatedAt > a.updatedAt ? b : a),
  },
  // Union; the most recent bookmark time wins (so re-adding beats a delete).
  bookmarks: {
    fix: fixBookmark,
    ts: (e) => e.at,
    pick: (a, b) => (b.at > a.at ? b : a),
  },
  // Latest review wins; if neither was reviewed, the earliest due date wins.
  review: {
    fix: fixReview,
    // Never-reviewed cards: approximate when they were scheduled.
    ts: (e) => e.lastReviewed ?? e.due - e.intervalDays * 86_400_000,
    pick: (a, b) => {
      const la = a.lastReviewed ?? -1;
      const lb = b.lastReviewed ?? -1;
      if (la !== lb) return lb > la ? b : a;
      return b.due < a.due ? b : a;
    },
  },
};

function mergeRecords<K extends RecordName>(
  name: K,
  local: Collections[K],
  remote: Collections[K],
  tombstones: Record<string, number>,
): Collections[K] {
  const rule = RECORD_RULES[name] as unknown as {
    ts: (e: unknown) => number;
    pick: (a: unknown, b: unknown) => unknown;
  };
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const k of keys) {
    const l = (local as Record<string, unknown>)[k];
    const r = (remote as Record<string, unknown>)[k];
    const winner = l && r ? rule.pick(l, r) : (l ?? r);
    const deletedAt = tombstones[k];
    if (deletedAt && rule.ts(winner) <= deletedAt) continue;
    out[k] = winner;
    delete tombstones[k]; // re-created after deletion
  }
  return out as Collections[K];
}

/** Drop the oldest entries until the serialized document fits the size cap. */
function trimToFit<K extends RecordName>(name: K, data: Collections[K]): Collections[K] {
  if (JSON.stringify(data).length <= MAX_DOC_CHARS) return data;
  const ts = RECORD_RULES[name].ts as (e: unknown) => number;
  let entries = Object.entries(data as Record<string, unknown>).sort((a, b) => ts(b[1]) - ts(a[1]));
  while (entries.length > 1) {
    entries = entries.slice(0, Math.floor(entries.length * 0.9));
    const next = Object.fromEntries(entries);
    if (JSON.stringify(next).length <= MAX_DOC_CHARS) return next as Collections[K];
  }
  return Object.fromEntries(entries) as Collections[K];
}

/* ------------------------------------------------------------ the engine */

type Base = { userId: string; keys: string[] };

class SyncSession {
  private stopped = false;
  private userDataAvailable = true;
  private pending = new Set<SyncedName>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();
  private lastRefresh = 0;
  private unsubscribe: (() => void) | null = null;
  private cleanups: (() => void)[] = [];

  constructor(private readonly userId: string) {}

  start() {
    this.unsubscribe = onLocalChange((name) => {
      if (name === "settings")
        writeMeta("settings-updated", { userId: this.userId, at: Date.now() });
      if ((SYNCED as CollectionName[]).includes(name)) this.schedule(name as SyncedName);
    });

    const onVisible = () => {
      if (document.visibilityState === "hidden") this.flushNow();
      else if (Date.now() - this.lastRefresh > REFRESH_MIN_INTERVAL_MS) this.refresh();
    };
    const onUnload = () => this.flushNow();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onUnload);
    this.cleanups.push(
      () => document.removeEventListener("visibilitychange", onVisible),
      () => window.removeEventListener("pagehide", onUnload),
    );

    this.refresh();
  }

  stop() {
    // Pending pushes are dropped (the session is gone); local data is kept and
    // re-merged on the next sign-in.
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.unsubscribe?.();
    this.cleanups.forEach((c) => c());
  }

  /** Full pull + merge + push, plus server → local hydration. */
  refresh(): Promise<void> {
    this.lastRefresh = Date.now();
    return this.enqueue(async () => {
      setStatus("syncing");
      let ok = true;
      for (const name of SYNCED as SyncedName[]) {
        ok = (await this.syncCollection(name)) && ok;
      }
      ok = (await this.hydrateSolved()) && ok;
      ok = (await this.hydrateActivity()) && ok;
      setStatus(ok ? "synced" : "error");
    });
  }

  private schedule(name: SyncedName) {
    if (this.stopped) return;
    this.pending.add(name);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flushNow(), PUSH_DEBOUNCE_MS);
  }

  private flushNow() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.stopped || !this.pending.size) return;
    const names = [...this.pending];
    this.pending.clear();
    void this.enqueue(async () => {
      setStatus("syncing");
      let ok = true;
      for (const name of names) ok = (await this.syncCollection(name)) && ok;
      setStatus(ok ? "synced" : "error");
    });
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(async () => {
      if (this.stopped) return;
      try {
        await task();
      } catch (e) {
        log("task failed", e);
        setStatus("error");
      }
    });
    return this.chain;
  }

  private async pull(name: SyncedName): Promise<SyncDoc<unknown> | null | "error"> {
    const { data, error } = await supabase
      .from("user_data")
      .select("value")
      .eq("user_id", this.userId)
      .eq("key", name)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) this.userDataAvailable = false;
      else log("pull failed", name, error.message);
      return "error";
    }
    const value = data?.value as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const doc = value as Partial<SyncDoc<unknown>>;
    return {
      v: num(doc.v, 1),
      updatedAt: num(doc.updatedAt),
      data: doc.data,
      deleted: doc.deleted,
    };
  }

  private async push(name: SyncedName, doc: SyncDoc<unknown>): Promise<boolean> {
    const { error } = await supabase
      .from("user_data")
      .upsert(
        { user_id: this.userId, key: name, value: doc as unknown as Json },
        { onConflict: "user_id,key" },
      );
    if (error) {
      if (isMissingTable(error)) this.userDataAvailable = false;
      else log("push failed", name, error.message);
      return false;
    }
    return true;
  }

  /** Pull the cloud copy, merge with local, write both sides if they changed. */
  private async syncCollection(name: SyncedName): Promise<boolean> {
    if (!this.userDataAvailable || this.stopped) return true;
    const remote = await this.pull(name);
    if (remote === "error") return !this.userDataAvailable; // missing table isn't an error
    if (this.stopped) return true;
    return name === "settings" ? this.syncSettings(remote) : this.syncRecords(name, remote);
  }

  private async syncRecords(name: RecordName, remote: SyncDoc<unknown> | null): Promise<boolean> {
    const rule = RECORD_RULES[name];
    const local = getCollection(name) as Record<string, unknown>;
    const remoteData = sanitizeRecord(remote?.data, rule.fix as never) as Record<string, unknown>;
    const tombstones = sanitizeTombstones(remote?.deleted);

    // Keys we synced before but that are gone locally were deleted on this device.
    const base = readMeta<Base>(`base:${name}`);
    if (base?.userId === this.userId) {
      const now = Date.now();
      for (const k of base.keys)
        if (!(k in local)) tombstones[k] = Math.max(tombstones[k] ?? 0, now);
    }

    const merged = mergeRecords(name, local as never, remoteData as never, tombstones) as Record<
      string,
      unknown
    >;
    if (stable(merged) !== stable(local)) {
      setCollection(name, merged as never, { silent: true });
    }

    // Only the uploaded copy is trimmed; the device keeps everything.
    const upload = trimToFit(name, merged as never) as Record<string, unknown>;
    let ok = true;
    const remoteChanged =
      !remote ||
      stable(upload) !== stable(remoteData) ||
      stable(tombstones) !== stable(sanitizeTombstones(remote.deleted));
    if (remoteChanged && (remote || Object.keys(upload).length || Object.keys(tombstones).length)) {
      ok = await this.push(name, {
        v: DOC_VERSION,
        updatedAt: Date.now(),
        data: upload,
        deleted: tombstones,
      });
    }
    if (ok)
      writeMeta(`base:${name}`, { userId: this.userId, keys: Object.keys(merged) } satisfies Base);
    return ok;
  }

  private async syncSettings(remote: SyncDoc<unknown> | null): Promise<boolean> {
    const local = getCollection("settings");
    const meta = readMeta<{ userId?: string; at: number }>("settings-updated");
    const localAt = meta ? num(meta.at) : 0;

    if (remote && remote.updatedAt >= localAt) {
      const next = fixSettings(remote.data);
      if (stable(next) !== stable(local)) setCollection("settings", next, { silent: true });
      writeMeta("settings-updated", { userId: this.userId, at: remote.updatedAt });
      return true;
    }
    // Local is newer (or the cloud has none): push, unless it's untouched defaults.
    if (!remote && !localAt) return true;
    return this.push("settings", { v: DOC_VERSION, updatedAt: localAt || Date.now(), data: local });
  }

  /** Server-verified solves → local solved set (local-only solves are kept). */
  private async hydrateSolved(): Promise<boolean> {
    const { data, error } = await supabase
      .from("solved_problems")
      .select("problem_id, problem_title, difficulty, topic, language, runtime_ms, solved_at")
      .eq("user_id", this.userId)
      .order("solved_at", { ascending: false })
      .limit(5000);
    if (error) return isMissingTable(error);
    if (!data?.length || this.stopped) return true;

    const prev = getCollection("solved");
    const next: Record<string, SolvedEntry> = { ...prev };
    for (const row of data) {
      const slug = row.problem_id;
      if (!slug) continue;
      const existing = prev[slug];
      const at = new Date(row.solved_at).getTime() || Date.now();
      next[slug] = {
        slug,
        title: row.problem_title || existing?.title || slug,
        difficulty: asDifficulty(row.difficulty || existing?.difficulty),
        topic: row.topic ?? existing?.topic ?? null,
        language: asLang(row.language, existing?.language ?? "python"),
        solvedAt: existing ? Math.min(existing.solvedAt, at) : at,
        runtimeMs: row.runtime_ms ?? existing?.runtimeMs ?? null,
        verified: true,
      };
    }
    if (stable(next) !== stable(prev)) setCollection("solved", next, { silent: true });
    return true;
  }

  /** Server submission days → local activity map (union of days, max count). */
  private async hydrateActivity(): Promise<boolean> {
    const { data, error } = await supabase
      .from("code_submissions")
      .select("created_at")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) return isMissingTable(error);
    if (!data?.length || this.stopped) return true;

    const serverDays: Record<string, number> = {};
    for (const row of data) {
      const t = new Date(row.created_at).getTime();
      if (Number.isNaN(t)) continue;
      const k = dayKey(t);
      serverDays[k] = (serverDays[k] ?? 0) + 1;
    }
    const prev = getCollection("activity");
    const next = { ...prev };
    let changed = false;
    for (const [k, n] of Object.entries(serverDays)) {
      if ((next[k] ?? 0) < n) {
        next[k] = n;
        changed = true;
      }
    }
    if (changed) setCollection("activity", next, { silent: true });
    return true;
  }
}

/* ------------------------------------------------------ status + React */

let status: SyncStatus = "off";
const statusListeners = new Set<(s: SyncStatus) => void>();
function setStatus(next: SyncStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((l) => l(next));
}
export function getSyncStatus(): SyncStatus {
  return status;
}
export function onSyncStatus(cb: (s: SyncStatus) => void): () => void {
  statusListeners.add(cb);
  return () => {
    statusListeners.delete(cb);
  };
}

let active: SyncSession | null = null;

/** Force a full sync now (e.g. from Settings). Resolves when it finishes. */
export function syncNow(): Promise<void> {
  return active ? active.refresh() : Promise.resolve();
}

/**
 * Mount once inside <AuthProvider>. Starts syncing when a user signs in and
 * stops (keeping local data) when they sign out. Renders nothing.
 */
export function CloudSync(): null {
  const { user, enabled } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !userId || typeof window === "undefined") return;
    let session: SyncSession | null = null;
    try {
      session = new SyncSession(userId);
      active = session;
      session.start();
    } catch (e) {
      log("failed to start", e);
    }
    return () => {
      try {
        session?.stop();
      } catch {
        /* ignore */
      }
      if (active === session) active = null;
      setStatus("off");
    };
  }, [enabled, userId]);

  return null;
}
