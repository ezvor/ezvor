import { createMiddleware } from "@tanstack/react-start";

import { isSupabaseConfigured, supabase } from "./client";

// Registered as a global function middleware in src/start.ts so every server
// function call from the browser carries the user's access token.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (!isSupabaseConfigured) return next();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
