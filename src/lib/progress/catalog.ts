// Shared client-side access to the problem catalog (lazy JSON asset).
import { useEffect, useMemo, useState } from "react";

import { loadCatalog, type LcCatalog, type LcProblem } from "@/data/leetcodeCatalog";

export type CatalogState = {
  catalog: LcCatalog | null;
  error: string | null;
  bySlug: Map<string, LcProblem>;
};

const EMPTY = new Map<string, LcProblem>();
let indexCache: { catalog: LcCatalog; bySlug: Map<string, LcProblem> } | null = null;

function indexFor(catalog: LcCatalog | null): Map<string, LcProblem> {
  if (!catalog) return EMPTY;
  if (indexCache?.catalog === catalog) return indexCache.bySlug;
  const bySlug = new Map(catalog.problems.map((p) => [p.slug, p]));
  indexCache = { catalog, bySlug };
  return bySlug;
}

/** Load the catalog once per session. Returns null until it arrives (and on the server). */
export function useCatalog(): CatalogState {
  const [catalog, setCatalog] = useState<LcCatalog | null>(indexCache?.catalog ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (catalog) return;
    let alive = true;
    loadCatalog()
      .then((c) => alive && setCatalog(c))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [catalog]);

  const bySlug = useMemo(() => indexFor(catalog), [catalog]);
  return { catalog, error, bySlug };
}

/** "two-sum" -> "Two Sum" (fallback title before the catalog loads). */
export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
