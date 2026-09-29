import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * The one place that knows how to link into the arena, so the URL shape can
 * change without touching every page. `list` enables list navigation there.
 */
export function problemHref(slug: string, list?: string | null): string {
  return `/problems/${encodeURIComponent(slug)}${list ? `?list=${encodeURIComponent(list)}` : ""}`;
}

export function ProblemLink({
  slug,
  list,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  slug: string;
  list?: string | null;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      to="/problems/$slug"
      params={{ slug }}
      search={list ? { list } : {}}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
