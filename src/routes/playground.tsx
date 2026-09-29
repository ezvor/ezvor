import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy entry point. The arena lives at /problems/$slug; old links
// (/playground?problem=<slug>) and the sidebar's "EzCode" item land here.

const DEFAULT_SLUG = "two-sum";
const SLUG_RE = /^[a-z0-9-]{1,120}$/;

export const Route = createFileRoute("/playground")({
  validateSearch: (search: Record<string, unknown>): { problem?: string; list?: string } => ({
    problem: typeof search.problem === "string" ? search.problem : undefined,
    list: typeof search.list === "string" ? search.list : undefined,
  }),
  beforeLoad: ({ search }) => {
    const slug = search.problem && SLUG_RE.test(search.problem) ? search.problem : DEFAULT_SLUG;
    throw redirect({
      to: "/problems/$slug",
      params: { slug },
      search: search.list ? { list: search.list } : {},
      replace: true,
    });
  },
});
