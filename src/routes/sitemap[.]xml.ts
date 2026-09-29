import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { absoluteUrl } from "@/config/site";
import { STUDY_LISTS } from "@/data/lists";

type Entry = { path: string; changefreq: "daily" | "weekly" | "monthly"; priority: number };

const PAGES: Entry[] = [
  { path: "/", changefreq: "daily", priority: 1.0 },
  { path: "/problems", changefreq: "weekly", priority: 0.9 },
  { path: "/lists", changefreq: "monthly", priority: 0.9 },
  { path: "/leaderboard", changefreq: "daily", priority: 0.5 },
  { path: "/compiler", changefreq: "monthly", priority: 0.6 },
  { path: "/roadmaps", changefreq: "weekly", priority: 0.8 },
  { path: "/readiness", changefreq: "monthly", priority: 0.6 },
  { path: "/opportunities", changefreq: "daily", priority: 0.8 },
  { path: "/resources", changefreq: "weekly", priority: 0.7 },
  { path: "/advisor", changefreq: "monthly", priority: 0.5 },
];

/** Problem slugs from the catalog asset: filesystem first (Node), then over HTTP. */
async function catalogSlugs(request: Request): Promise<string[]> {
  type Catalog = { problems: { slug: string; paid: boolean }[] };
  const pick = (c: Catalog) => c.problems.map((p) => p.slug);
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    for (const dir of ["public", ".output/public", "dist/client"]) {
      try {
        const raw = await fs.readFile(
          path.join(process.cwd(), dir, "leetcode-catalog.json"),
          "utf8",
        );
        return pick(JSON.parse(raw) as Catalog);
      } catch {
        /* try the next location */
      }
    }
  } catch {
    /* no filesystem (edge runtime) */
  }
  try {
    const res = await fetch(new URL("/leetcode-catalog.json", request.url));
    if (res.ok) return pick((await res.json()) as Catalog);
  } catch {
    /* fall through */
  }
  return [];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function urlTag(e: Entry): string {
  return `  <url><loc>${esc(absoluteUrl(e.path))}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority.toFixed(1)}</priority></url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const entries: Entry[] = [
          ...PAGES,
          ...STUDY_LISTS.map((l) => ({
            path: `/lists/${l.id}`,
            changefreq: "monthly" as const,
            priority: 0.8,
          })),
          ...(await catalogSlugs(request)).map((slug) => ({
            path: `/problems/${slug}`,
            changefreq: "monthly" as const,
            priority: 0.6,
          })),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(urlTag).join("\n")}\n</urlset>\n`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
