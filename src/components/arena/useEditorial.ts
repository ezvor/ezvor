import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { getProblemEditorial, type EditorialData } from "@/lib/editorial.functions";
import { editorialCache } from "./cache";

export type EditorialState = {
  editorial: EditorialData | null;
  loading: boolean;
  error: string | null;
  load: (refresh?: boolean) => Promise<void>;
};

/**
 * Editorial for `slug`. Warms from the shared cache in the background (never
 * generating), and generates on demand once `wanted` becomes true.
 */
export function useEditorial(slug: string, ready: boolean, wanted: boolean): EditorialState {
  const fetchFn = useServerFn(getProblemEditorial);
  // Tagged with its slug so a stale editorial never flashes after switching problems.
  const [entry, setEntry] = useState<{ slug: string; data: EditorialData } | null>(() => {
    const cached = editorialCache.get(slug);
    return cached ? { slug, data: cached } : null;
  });
  const editorial = entry?.slug === slug ? entry.data : (editorialCache.get(slug) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slugRef = useRef(slug);
  slugRef.current = slug;

  useEffect(() => {
    setError(null);
    setLoading(false);
  }, [slug]);

  const load = useCallback(
    async (refresh = false) => {
      if (!ready) return;
      const target = slug;
      if (!refresh) {
        const cached = editorialCache.get(target);
        if (cached) {
          setEntry({ slug: target, data: cached });
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchFn({ data: { slug: target, refresh } });
        if (!data) throw new Error("empty editorial");
        editorialCache.set(target, data);
        setEntry({ slug: target, data });
      } catch {
        if (slugRef.current === target) {
          setError("Couldn't generate the editorial right now. Please try again in a moment.");
        }
      } finally {
        if (slugRef.current === target) setLoading(false);
      }
    },
    [ready, slug, fetchFn],
  );

  // Background warm-up from the shared cache: instant tabs, no generation cost.
  useEffect(() => {
    if (!ready || editorialCache.has(slug)) return;
    let cancelled = false;
    fetchFn({ data: { slug, cachedOnly: true } })
      .then((data) => {
        if (!data) return;
        editorialCache.set(slug, data);
        if (!cancelled) setEntry((cur) => (cur?.slug === slug ? cur : { slug, data }));
      })
      .catch(() => {
        /* generated on demand when the tab opens */
      });
    return () => {
      cancelled = true;
    };
  }, [slug, ready, fetchFn]);

  // Generate on first open of Editorial / Solutions.
  useEffect(() => {
    if (wanted && ready && !editorial && !loading && !error) void load(false);
  }, [wanted, ready, editorial, loading, error, load]);

  return { editorial, loading, error, load };
}
