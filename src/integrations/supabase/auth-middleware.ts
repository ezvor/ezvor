import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  claims: Record<string, unknown>;
};

function publicEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

function bearerToken(): string | null {
  const header = getRequest()?.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

/** Verify the caller's access token and build an RLS-scoped client for them. */
async function resolveUser(): Promise<AuthContext | null> {
  const env = publicEnv();
  const token = bearerToken();
  if (!env || !token) return null;

  const supabase = createClient<Database>(env.url, env.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  return { supabase, userId: sub, claims: data.claims as Record<string, unknown> };
}

/** Rejects the call unless a valid Supabase session is attached. */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!publicEnv()) throw new Error("Accounts are not enabled on this deployment.");
    const auth = await resolveUser();
    if (!auth) throw new Error("Unauthorized");
    return next({ context: auth });
  },
);

/** Attaches the user when signed in, but lets anonymous callers through. */
export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const auth = await resolveUser().catch(() => null);
    return next({
      context: {
        supabase: auth?.supabase ?? null,
        userId: auth?.userId ?? null,
      },
    });
  },
);
