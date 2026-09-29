// Tiny in-memory cache + fetch helpers for the job feeds.
//
// Every feed response is cached per server instance for ~15 minutes, concurrent
// callers share one in-flight request, and a failing feed serves its last good
// value (or is skipped for a minute) instead of being hammered.

const UA = "Mozilla/5.0 (compatible; EzvorJobs/1.0; +https://github.com/ezvor)";

type Entry<T> = { at: number; ttl: number; value: T };

const store = new Map<string, Entry<unknown>>();
const failures = new Map<string, number>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 200;

export const FEED_TTL_MS = 15 * 60_000;
const FAILURE_BACKOFF_MS = 60_000;

/**
 * Return a cached value or compute it. Throws only when the loader fails and
 * there is no previous value to fall back on.
 */
export async function cached<T>(
  key: string,
  load: () => Promise<T>,
  ttlMs = FEED_TTL_MS,
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;

  const failedAt = failures.get(key);
  if (failedAt && Date.now() - failedAt < FAILURE_BACKOFF_MS) {
    if (hit) return hit.value;
    throw new Error(`${key} is cooling down after a failure`);
  }

  let job = inflight.get(key) as Promise<T> | undefined;
  if (!job) {
    job = (async () => {
      try {
        const value = await load();
        store.delete(key);
        store.set(key, { at: Date.now(), ttl: ttlMs, value });
        failures.delete(key);
        if (store.size > MAX_ENTRIES) {
          const oldest = store.keys().next().value;
          if (oldest) store.delete(oldest);
        }
        return value;
      } catch (e) {
        failures.set(key, Date.now());
        throw e;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, job);
  }

  try {
    return await job;
  } catch (e) {
    if (hit) return hit.value;
    throw e;
  }
}

export async function fetchJSON<T>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json", ...opts.headers },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 9_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

/** Resolve `p`, or `fallback` once `ms` elapses (the work keeps filling the cache). */
export function withDeadline<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/* ------------------------------------------------------------ text utils */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  euro: "€",
  pound: "£",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => safeChar(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

function safeChar(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/** HTML → plain text (block tags become line breaks). */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>|<p[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Repair UTF-8 text that was decoded as Latin-1 somewhere upstream ("MecÃ¡nico"). */
export function fixMojibake(s: string): string {
  if (!/[ÃÂâ][\u0080-ÿ]/.test(s) || /[^\u0000-ÿ]/.test(s)) return s;
  try {
    const bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff));
    const fixed = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return fixed;
  } catch {
    return s;
  }
}

export function snippet(text: string, max = 280): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trim()}…`;
}
