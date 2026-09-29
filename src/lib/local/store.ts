// Local-first user data. Everything a learner produces lives in the browser
// first (works signed-out and offline) and is mirrored to the cloud when the
// user is signed in (see ./sync.ts).
//
// Each collection is a JSON document in localStorage under "ezvor:v2:<name>".
// Components subscribe with `useCollection(name)`; writes notify every
// subscriber in this tab and in other tabs.

import { useSyncExternalStore } from "react";

import type { LangKey } from "@/lib/judge/languages";
import type { Verdict } from "@/lib/judge/types";

export type Difficulty = "Easy" | "Medium" | "Hard";

export type SolvedEntry = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topic?: string | null;
  language: LangKey;
  solvedAt: number;
  runtimeMs?: number | null;
  /** Judged by the server against trusted tests (vs. in-browser only). */
  verified?: boolean;
};

export type SubmissionEntry = {
  id: string;
  slug: string;
  title: string;
  status: Verdict;
  language: LangKey;
  passed: number;
  total: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  at: number;
  code?: string;
  verified?: boolean;
};

export type NoteEntry = { slug: string; text: string; updatedAt: number };
export type BookmarkEntry = { slug: string; at: number };

/** SM-2 style spaced-repetition card. */
export type ReviewEntry = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  due: number;
  intervalDays: number;
  ease: number;
  reps: number;
  lastReviewed: number | null;
};

export type EditorSettings = {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  theme: "vs-dark" | "light";
  keybindings: "standard" | "vim";
  preferredLanguage: LangKey;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: false,
  minimap: false,
  theme: "vs-dark",
  keybindings: "standard",
  preferredLanguage: "python",
};

export type Collections = {
  solved: Record<string, SolvedEntry>;
  submissions: SubmissionEntry[];
  notes: Record<string, NoteEntry>;
  bookmarks: Record<string, BookmarkEntry>;
  review: Record<string, ReviewEntry>;
  /** YYYY-MM-DD (local time) -> number of submissions that day. */
  activity: Record<string, number>;
  settings: EditorSettings;
};

export type CollectionName = keyof Collections;

const DEFAULTS: { [K in CollectionName]: () => Collections[K] } = {
  solved: () => ({}),
  submissions: () => [],
  notes: () => ({}),
  bookmarks: () => ({}),
  review: () => ({}),
  activity: () => ({}),
  settings: () => ({ ...DEFAULT_EDITOR_SETTINGS }),
};

/** Collections mirrored to the cloud `user_data` table for signed-in users. */
export const SYNCED: CollectionName[] = ["notes", "bookmarks", "review", "settings"];

const PREFIX = "ezvor:v2:";
const MAX_SUBMISSIONS = 400;
const MAX_CODE_SUBMISSIONS = 80;

const memory = new Map<CollectionName, unknown>();
const listeners = new Map<CollectionName, Set<() => void>>();
const changeHooks = new Set<(name: CollectionName) => void>();

const hasStorage = () => typeof window !== "undefined" && !!window.localStorage;

function read<K extends CollectionName>(name: K): Collections[K] {
  if (memory.has(name)) return memory.get(name) as Collections[K];
  let value: Collections[K] = DEFAULTS[name]();
  if (hasStorage()) {
    try {
      const raw = window.localStorage.getItem(PREFIX + name);
      if (raw) {
        const parsed = JSON.parse(raw) as Collections[K];
        value =
          name === "settings"
            ? ({ ...DEFAULT_EDITOR_SETTINGS, ...(parsed as EditorSettings) } as Collections[K])
            : parsed;
      }
    } catch {
      /* corrupt or blocked storage — fall back to defaults */
    }
  }
  memory.set(name, value);
  return value;
}

function emit(name: CollectionName) {
  listeners.get(name)?.forEach((l) => l());
}

function write<K extends CollectionName>(
  name: K,
  value: Collections[K],
  opts: { silent?: boolean } = {},
) {
  memory.set(name, value);
  if (hasStorage()) {
    try {
      window.localStorage.setItem(PREFIX + name, JSON.stringify(value));
    } catch {
      /* quota exceeded — keep the in-memory copy */
    }
  }
  emit(name);
  if (!opts.silent) changeHooks.forEach((h) => h(name));
}

export function getCollection<K extends CollectionName>(name: K): Collections[K] {
  return read(name);
}

export function setCollection<K extends CollectionName>(
  name: K,
  next: Collections[K] | ((prev: Collections[K]) => Collections[K]),
  opts: { silent?: boolean } = {},
) {
  const value =
    typeof next === "function" ? (next as (p: Collections[K]) => Collections[K])(read(name)) : next;
  write(name, value, opts);
}

function subscribe(name: CollectionName, cb: () => void) {
  let set = listeners.get(name);
  if (!set) listeners.set(name, (set = new Set()));
  set.add(cb);
  return () => set!.delete(cb);
}

const serverSnapshots = new Map<CollectionName, unknown>();
function serverSnapshot<K extends CollectionName>(name: K): Collections[K] {
  if (!serverSnapshots.has(name)) serverSnapshots.set(name, DEFAULTS[name]());
  return serverSnapshots.get(name) as Collections[K];
}

/** Subscribe a component to a collection (SSR-safe: defaults on the server). */
export function useCollection<K extends CollectionName>(name: K): Collections[K] {
  return useSyncExternalStore(
    (cb) => subscribe(name, cb),
    () => read(name),
    () => serverSnapshot(name),
  );
}

/** Called after any local (non-silent) change — used by cloud sync. */
export function onLocalChange(hook: (name: CollectionName) => void): () => void {
  changeHooks.add(hook);
  return () => changeHooks.delete(hook);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    const name = e.key.slice(PREFIX.length) as CollectionName;
    if (!(name in DEFAULTS)) return;
    memory.delete(name);
    emit(name);
  });
}

/* --------------------------------------------------------------- helpers */

export function dayKey(ts = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Record a judged submission locally (history, activity, solved set, review queue). */
export function recordSubmission(
  entry: Omit<SubmissionEntry, "id" | "at"> & { difficulty: Difficulty; topic?: string | null },
) {
  const at = Date.now();
  const id = `${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const { difficulty, topic, ...sub } = entry;

  setCollection("submissions", (prev) => {
    const next = [{ ...sub, id, at }, ...prev].slice(0, MAX_SUBMISSIONS);
    // Only keep source code for the most recent submissions to stay within quota.
    return next.map((s, i) =>
      i >= MAX_CODE_SUBMISSIONS && s.code ? { ...s, code: undefined } : s,
    );
  });
  setCollection("activity", (prev) => {
    const k = dayKey(at);
    return { ...prev, [k]: (prev[k] ?? 0) + 1 };
  });

  if (entry.status === "Accepted") {
    setCollection("solved", (prev) => {
      const existing = prev[entry.slug];
      return {
        ...prev,
        [entry.slug]: {
          slug: entry.slug,
          title: entry.title,
          difficulty,
          topic: topic ?? existing?.topic ?? null,
          language: entry.language,
          solvedAt: existing?.solvedAt ?? at,
          runtimeMs: entry.runtimeMs,
          verified: existing?.verified || entry.verified,
        },
      };
    });
    // First solve schedules a review in 3 days (spaced repetition).
    setCollection("review", (prev) =>
      prev[entry.slug]
        ? prev
        : {
            ...prev,
            [entry.slug]: {
              slug: entry.slug,
              title: entry.title,
              difficulty,
              due: at + 3 * 86_400_000,
              intervalDays: 3,
              ease: 2.5,
              reps: 0,
              lastReviewed: null,
            },
          },
    );
  }
  return id;
}

/** Grade a review (0 = forgot … 3 = easy) and reschedule it, SM-2 style. */
export function gradeReview(slug: string, grade: 0 | 1 | 2 | 3) {
  setCollection("review", (prev) => {
    const card = prev[slug];
    if (!card) return prev;
    const now = Date.now();
    let { ease, intervalDays, reps } = card;
    if (grade === 0) {
      reps = 0;
      intervalDays = 1;
    } else {
      reps += 1;
      ease = Math.max(1.3, ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0));
      intervalDays = reps === 1 ? 3 : Math.round(intervalDays * (grade === 1 ? 1.2 : ease));
    }
    return {
      ...prev,
      [slug]: {
        ...card,
        ease,
        intervalDays,
        reps,
        lastReviewed: now,
        due: now + intervalDays * 86_400_000,
      },
    };
  });
}

export function toggleBookmark(slug: string): boolean {
  let on = false;
  setCollection("bookmarks", (prev) => {
    if (prev[slug]) {
      const { [slug]: _removed, ...rest } = prev;
      return rest;
    }
    on = true;
    return { ...prev, [slug]: { slug, at: Date.now() } };
  });
  return on;
}

export function saveNote(slug: string, text: string) {
  setCollection("notes", (prev) => {
    if (!text.trim()) {
      const { [slug]: _removed, ...rest } = prev;
      return rest;
    }
    return { ...prev, [slug]: { slug, text, updatedAt: Date.now() } };
  });
}

export type StreakStats = { current: number; longest: number; activeDays: number; today: number };

/** Streaks from the local activity map (local calendar days). */
export function streakStats(activity: Record<string, number>): StreakStats {
  const days = Object.keys(activity)
    .filter((k) => activity[k] > 0)
    .sort();
  const set = new Set(days);
  const today = dayKey();
  const yesterday = dayKey(Date.now() - 86_400_000);
  let current = 0;
  if (set.has(today) || set.has(yesterday)) {
    const cursor = new Date(set.has(today) ? Date.now() : Date.now() - 86_400_000);
    while (set.has(dayKey(cursor.getTime()))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    if (prev) {
      const next = new Date(`${prev}T12:00:00`);
      next.setDate(next.getDate() + 1);
      run = dayKey(next.getTime()) === d ? run + 1 : 1;
    } else run = 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return {
    current,
    longest: Math.max(longest, current),
    activeDays: days.length,
    today: activity[today] ?? 0,
  };
}

/* ------------------------------------------------ one-time legacy import */

if (typeof window !== "undefined" && hasStorage()) {
  try {
    const legacy = window.localStorage.getItem("ezvor.solved.v1");
    if (legacy && !window.localStorage.getItem(PREFIX + "solved")) {
      const slugs = JSON.parse(legacy) as string[];
      const solved: Record<string, SolvedEntry> = {};
      for (const slug of slugs) {
        solved[slug] = {
          slug,
          title: slug
            .split("-")
            .map((w) => w[0]?.toUpperCase() + w.slice(1))
            .join(" "),
          difficulty: "Medium",
          language: "python",
          solvedAt: Date.now(),
        };
      }
      write("solved", solved, { silent: true });
    }
  } catch {
    /* ignore */
  }
}
