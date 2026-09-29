// Shared cache for expensive, immutable per-problem artifacts (statements,
// judge harnesses, editorials).
//
// Reads/writes go to Supabase when the service-role key is configured (shared
// across every instance and user), with an in-memory LRU in front of it. With
// no database the in-memory layer alone still makes repeat opens instant for
// the lifetime of the server instance, and the browser keeps its own copy.

import { isAdminConfigured } from "@/integrations/supabase/client.server";

export type CacheTable = "problem_statements" | "problem_harnesses" | "problem_solutions";

const MAX_ENTRIES = 400;
const memory = new Map<string, unknown>();

function memKey(table: CacheTable, slug: string) {
  return `${table}:${slug}`;
}

function remember(key: string, value: unknown) {
  memory.delete(key);
  memory.set(key, value);
  if (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
}

export async function cacheGet<T>(table: CacheTable, slug: string): Promise<T | null> {
  const key = memKey(table, slug);
  if (memory.has(key)) {
    const v = memory.get(key) as T;
    remember(key, v);
    return v;
  }
  if (!isAdminConfigured()) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from(table).select("data").eq("slug", slug).maybeSingle();
    if (data?.data) {
      remember(key, data.data);
      return data.data as T;
    }
  } catch (e) {
    console.warn(`[cache] read ${table}/${slug} failed`, e);
  }
  return null;
}

export async function cacheSet(
  table: CacheTable,
  slug: string,
  value: unknown,
  opts: { persist?: boolean } = {},
): Promise<void> {
  remember(memKey(table, slug), value);
  if (opts.persist === false || !isAdminConfigured()) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from(table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ slug, data: value as any }, { onConflict: "slug" });
  } catch (e) {
    console.warn(`[cache] write ${table}/${slug} failed`, e);
  }
}
