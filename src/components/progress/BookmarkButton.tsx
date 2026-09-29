import { Bookmark } from "lucide-react";

import { toggleBookmark, useCollection } from "@/lib/local/store";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  slug,
  title,
  className,
}: {
  slug: string;
  title?: string;
  className?: string;
}) {
  const bookmarks = useCollection("bookmarks");
  const on = Boolean(bookmarks[slug]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark(slug);
      }}
      aria-pressed={on}
      aria-label={
        on
          ? `Remove bookmark${title ? ` for ${title}` : ""}`
          : `Bookmark${title ? ` ${title}` : ""}`
      }
      title={on ? "Remove bookmark" : "Bookmark"}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on && "text-warning hover:text-warning",
        className,
      )}
    >
      <Bookmark className={cn("h-4 w-4", on && "fill-current")} />
    </button>
  );
}
