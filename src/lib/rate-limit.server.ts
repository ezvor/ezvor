// Best-effort, per-instance sliding-window rate limiter.
//
// Serverless instances are reused for many requests (Vercel Fluid compute,
// Netlify, Node), so an in-memory window stops casual abuse of the free AI
// and runner quotas without any external store.

import { getRequest } from "@tanstack/react-start/server";

type Bucket = { limit: number; windowMs: number };

export const LIMITS = {
  /** Advisor chat + AI coach messages. */
  chat: { limit: 40, windowMs: 10 * 60_000 },
  /** Expensive generation: editorials, harnesses, roadmaps, interviews. */
  generate: { limit: 25, windowMs: 60 * 60_000 },
  /** Code execution through remote runners. */
  run: { limit: 90, windowMs: 10 * 60_000 },
  /** Scraping / search helpers (jobs, company intel, status checks). */
  search: { limit: 30, windowMs: 10 * 60_000 },
} satisfies Record<string, Bucket>;

export type LimitName = keyof typeof LIMITS;

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

export function clientIp(request?: Request | null): string {
  const req = request ?? safeRequest();
  const h = req?.headers;
  if (!h) return "unknown";
  return (
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-nf-client-connection-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function safeRequest(): Request | null {
  try {
    return getRequest() ?? null;
  } catch {
    return null;
  }
}

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, times] of hits) {
    if (!times.length || now - times[times.length - 1] > 3600_000) hits.delete(key);
  }
}

export class RateLimitError extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`Too many requests — please wait ${retryAfterSec}s and try again.`);
  }
}

/**
 * Consume one unit from `name` for the current caller. Signed-in users get a
 * higher allowance. Throws RateLimitError when the window is exhausted.
 */
export function enforceRateLimit(
  name: LimitName,
  opts: { userId?: string | null; request?: Request | null; cost?: number } = {},
): void {
  const bucket = LIMITS[name];
  const limit = opts.userId ? bucket.limit * 2 : bucket.limit;
  const who = opts.userId ? `u:${opts.userId}` : `ip:${clientIp(opts.request)}`;
  const key = `${name}:${who}`;
  const now = Date.now();
  sweep(now);
  const times = (hits.get(key) ?? []).filter((t) => now - t < bucket.windowMs);
  const cost = opts.cost ?? 1;
  if (times.length + cost > limit) {
    const retry = Math.ceil((bucket.windowMs - (now - times[0])) / 1000);
    hits.set(key, times);
    throw new RateLimitError(Math.max(1, retry));
  }
  for (let i = 0; i < cost; i++) times.push(now);
  hits.set(key, times);
}
