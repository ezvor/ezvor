// Guest AI-advisor chats, kept in the browser's localStorage.
//
// Signed-in users get database-backed threads (src/lib/threads.functions.ts);
// guests use this store so the advisor works without an account. Local thread
// ids are prefixed with "local-" so routes can tell the two apart, and the
// advisor offers to import them into an account after sign-in.

import { useSyncExternalStore } from "react";

export type ChatRole = "user" | "assistant";
export interface LocalMessage {
  role: ChatRole;
  content: string;
  at: number;
}
export interface LocalThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

const INDEX_KEY = "ezvor:v2:chats";
const MSG_PREFIX = "ezvor:v2:chat:";
const MAX_THREADS = 100;
const MAX_MESSAGES = 200;
const MAX_CONTENT = 40_000;
const DEFAULT_TITLE = "New chat";

const hasStorage = () => typeof window !== "undefined" && !!window.localStorage;

export function isLocalThreadId(id: string): boolean {
  return id.startsWith("local-");
}

let cache: LocalThread[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: LocalThread[] = [];

function readIndex(): LocalThread[] {
  if (cache) return cache;
  let list: LocalThread[] = [];
  if (hasStorage()) {
    try {
      const raw = window.localStorage.getItem(INDEX_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) {
        list = parsed.filter(
          (t): t is LocalThread =>
            !!t && typeof t === "object" && typeof (t as LocalThread).id === "string",
        );
      }
    } catch {
      /* corrupt storage — start fresh */
    }
  }
  cache = list.sort((a, b) => b.updatedAt - a.updatedAt);
  return cache;
}

function writeIndex(list: LocalThread[]) {
  cache = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  if (hasStorage()) {
    try {
      window.localStorage.setItem(INDEX_KEY, JSON.stringify(cache));
    } catch {
      /* quota exceeded — keep the in-memory copy */
    }
  }
  listeners.forEach((l) => l());
}

function msgKey(id: string) {
  return MSG_PREFIX + id;
}

export function listLocalThreads(): LocalThread[] {
  return readIndex();
}

export function getLocalThread(id: string): LocalThread | undefined {
  return readIndex().find((t) => t.id === id);
}

export function getLocalMessages(id: string): LocalMessage[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(msgKey(id));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is LocalMessage =>
        !!m &&
        typeof m === "object" &&
        ((m as LocalMessage).role === "user" || (m as LocalMessage).role === "assistant") &&
        typeof (m as LocalMessage).content === "string",
    );
  } catch {
    return [];
  }
}

function writeMessages(id: string, messages: LocalMessage[]) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(msgKey(id), JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch {
    /* quota exceeded */
  }
}

function newId() {
  return `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function titleFrom(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean || DEFAULT_TITLE;
}

export function createLocalThread(title?: string): LocalThread {
  const now = Date.now();
  const thread: LocalThread = {
    id: newId(),
    title: title ? titleFrom(title) : DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
  };
  const list = [thread, ...readIndex()];
  // Drop the oldest threads beyond the cap (and their messages).
  const kept = list.slice(0, MAX_THREADS);
  for (const t of list.slice(MAX_THREADS)) removeMessages(t.id);
  writeIndex(kept);
  return thread;
}

export function renameLocalThread(id: string, title: string) {
  const clean = title.trim().slice(0, 80);
  if (!clean) return;
  writeIndex(
    readIndex().map((t) => (t.id === id ? { ...t, title: clean, updatedAt: Date.now() } : t)),
  );
}

function removeMessages(id: string) {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(msgKey(id));
  } catch {
    /* ignore */
  }
}

export function deleteLocalThread(id: string) {
  removeMessages(id);
  writeIndex(readIndex().filter((t) => t.id !== id));
}

/** Persist a completed user + assistant exchange; auto-titles fresh threads. */
export function appendLocalExchange(id: string, userContent: string, assistantContent: string) {
  const now = Date.now();
  let thread = getLocalThread(id);
  if (!thread) {
    thread = { id, title: DEFAULT_TITLE, createdAt: now, updatedAt: now };
    writeIndex([thread, ...readIndex()]);
  }
  writeMessages(id, [
    ...getLocalMessages(id),
    { role: "user", content: userContent.slice(0, MAX_CONTENT), at: now },
    { role: "assistant", content: assistantContent.slice(0, MAX_CONTENT), at: now },
  ]);
  const title = thread.title === DEFAULT_TITLE ? titleFrom(userContent) : thread.title;
  writeIndex(readIndex().map((t) => (t.id === id ? { ...t, title, updatedAt: now } : t)));
}

/** Remove every local chat (used by Settings → clear local data). */
export function clearLocalChats() {
  for (const t of readIndex()) removeMessages(t.id);
  writeIndex([]);
}

/** All local chats with their messages (for export / import into an account). */
export function exportLocalChats(): (LocalThread & { messages: LocalMessage[] })[] {
  return readIndex().map((t) => ({ ...t, messages: getLocalMessages(t.id) }));
}

/** Merge chats from an exported JSON file (skips ids that already exist). */
export function importLocalChats(input: unknown): number {
  if (!Array.isArray(input)) return 0;
  const existing = new Set(readIndex().map((t) => t.id));
  const added: LocalThread[] = [];
  for (const raw of input.slice(0, MAX_THREADS)) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Partial<LocalThread> & { messages?: unknown };
    if (typeof t.id !== "string" || !isLocalThreadId(t.id) || existing.has(t.id)) continue;
    const messages = Array.isArray(t.messages)
      ? (t.messages as LocalMessage[])
          .filter(
            (m) =>
              !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
          )
          .map((m) => ({
            role: m.role,
            content: m.content.slice(0, MAX_CONTENT),
            at: Number(m.at) || Date.now(),
          }))
      : [];
    const thread: LocalThread = {
      id: t.id.slice(0, 40),
      title: typeof t.title === "string" ? t.title.slice(0, 80) : DEFAULT_TITLE,
      createdAt: Number(t.createdAt) || Date.now(),
      updatedAt: Number(t.updatedAt) || Date.now(),
    };
    writeMessages(thread.id, messages);
    added.push(thread);
  }
  if (added.length) writeIndex([...added, ...readIndex()].slice(0, MAX_THREADS));
  return added.length;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === INDEX_KEY) {
      cache = null;
      listeners.forEach((l) => l());
    }
  });
}

/** Subscribe a component to the local thread list (SSR-safe). */
export function useLocalThreads(): LocalThread[] {
  return useSyncExternalStore(subscribe, readIndex, () => EMPTY);
}
