import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { getList, listSlugs, type StudyList } from "@/data/lists";
import { useCollection } from "@/lib/local/store";
import { cn } from "@/lib/utils";

export function useStudyList(listId: string | undefined) {
  return useMemo(() => {
    const list = getList(listId);
    if (!list) return null;
    const slugs = listSlugs(list);
    return { list, slugs, set: new Set(slugs) };
  }, [listId]);
}

const navBtn =
  "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground";

/** Compact "NC150 · 12 / 150 · 34 solved" bar with prev/next inside the list. */
export function ListNavigator({
  list,
  slugs,
  slug,
}: {
  list: StudyList;
  slugs: string[];
  slug: string;
}) {
  const solved = useCollection("solved");
  const idx = slugs.indexOf(slug);
  const solvedCount = useMemo(() => slugs.filter((s) => solved[s]).length, [slugs, solved]);
  const prev = idx > 0 ? slugs[idx - 1] : null;
  const next = idx >= 0 ? (slugs[idx + 1] ?? null) : (slugs[0] ?? null);
  const search = { list: list.id };

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-card/60 pl-2 text-xs">
      <span className="max-w-[9rem] truncate font-semibold" title={list.name}>
        {list.short || list.name}
      </span>
      <span className="ml-1.5 tabular-nums text-muted-foreground">
        {idx >= 0 ? idx + 1 : "–"} / {slugs.length}
      </span>
      <span className="ml-1.5 hidden tabular-nums text-success lg:inline">
        {solvedCount} solved
      </span>
      <div className="ml-1 flex items-center border-l border-border/60">
        {prev ? (
          <Link
            to="/problems/$slug"
            params={{ slug: prev }}
            search={search}
            className={navBtn}
            aria-label="Previous in list"
            title="Previous in list"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className={cn(navBtn, "pointer-events-none opacity-40")} aria-hidden>
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        {next ? (
          <Link
            to="/problems/$slug"
            params={{ slug: next }}
            search={search}
            className={navBtn}
            aria-label="Next in list"
            title="Next in list"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={cn(navBtn, "pointer-events-none opacity-40")} aria-hidden>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
