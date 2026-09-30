import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Deploy target is resolved by Nitro at build time:
//   - Vercel / Netlify / Cloudflare are auto-detected from their CI environment.
//   - Anywhere else it falls back to a standalone Node server (`node .output/server/index.mjs`).
//   - Force one explicitly with NITRO_PRESET=vercel | netlify | node-server | cloudflare-module.
export default defineConfig(({ command, mode }) => {
  // Make .env available to server code (process.env) in dev and `vite preview`.
  // On Vercel/Netlify the platform injects real env vars, which take precedence.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  // The Supabase URL and anon key are public by design; let one pair of vars
  // configure both the server and the browser bundle.
  const publicSupabase = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    VITE_SUPABASE_PUBLISHABLE_KEY:
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
  };
  return {
    define: Object.fromEntries(
      Object.entries(publicSupabase).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
    ),
    server: {
      port: 8080,
      // Don't watch build output: on Windows a concurrent `npm run build` locks
      // these files and crashes the dev server's watcher (EBUSY).
      watch: {
        ignored: [
          "**/.output/**",
          "**/dist/**",
          "**/.vercel/**",
          "**/.netlify/**",
          "**/.tanstack/**",
        ],
      },
    },
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    },
    worker: { format: "es" as const },
    plugins: [
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tailwindcss(),
      tanstackStart({
        // src/server.ts wraps the generated SSR entry with a friendly error page.
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      command === "build" &&
        nitro({
          preset: process.env.NITRO_PRESET || undefined,
          // Vercel Hobby allows up to 300s with Fluid compute; first-time judge generation needs it.
          vercel: { functions: { maxDuration: 300 } },
        }),
      viteReact(),
    ],
  };
});
