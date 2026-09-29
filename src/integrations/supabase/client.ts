import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

// Browser + SSR client (publishable key, RLS enforced).
//
// Supabase is optional. When it isn't configured the app runs in local-first
// mode: progress, submissions and chats live in the browser and account
// features (sign-in, cloud sync, public profiles) are hidden.

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined);
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (typeof process !== "undefined" ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined);

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

function createSupabaseClient(): SupabaseClient<Database> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
}

let client: SupabaseClient<Database> | undefined;

/**
 * Lazily-created shared client. Guard calls with `isSupabaseConfigured` —
 * touching it without configuration throws a descriptive error.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    if (!client) client = createSupabaseClient();
    return Reflect.get(client, prop, receiver);
  },
});
