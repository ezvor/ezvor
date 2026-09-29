import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Deploy target is resolved by Nitro at build time:
//   - Vercel / Netlify / Cloudflare are auto-detected from their CI environment.
//   - Anywhere else it falls back to a standalone Node server (`node .output/server/index.mjs`).
//   - Force one explicitly with NITRO_PRESET=vercel | netlify | node-server | cloudflare-module.
export default defineConfig(({ command }) => ({
  server: { port: 8080 },
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
        // Vercel Hobby allows up to 300s with Fluid compute; AI generation can take a while.
        vercel: { functions: { maxDuration: 60 } },
      }),
    viteReact(),
  ],
}));
