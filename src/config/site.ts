// Brand + deployment constants. Rebranding or moving domains is a one-file change.

export const SITE = {
  name: "Ezvor",
  shortName: "Ezvor",
  url: ((import.meta.env.VITE_SITE_URL as string | undefined) || "https://qeelo.cloud").replace(
    /\/$/,
    "",
  ),
  tagline: "Practice DSA, plan your career, land the role.",
  description:
    "Ezvor is a free interview-prep and career platform: 3,900+ coding problems with an in-browser judge, curated study lists (Blind 75, NeetCode 150, Grind 75), an AI coach, roadmaps, and live opportunities.",
  ogImage: "/ezvor-banner.png",
  github: "https://github.com/ezvor/ezvor",
} as const;

export function absoluteUrl(path = "/"): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
