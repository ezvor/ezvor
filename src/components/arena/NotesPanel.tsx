import { Check, Loader2, NotebookPen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { saveNote, useCollection } from "@/lib/local/store";
import { PanelTitle, timeAgo } from "./ui";

const SAVE_DELAY_MS = 600;

/** Per-problem notes with debounced autosave. Mount with `key={slug}`. */
export function NotesPanel({ slug }: { slug: string }) {
  const { enabled } = useAuth();
  const notes = useCollection("notes");
  const stored = notes[slug];
  const [text, setText] = useState(stored?.text ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">(stored ? "saved" : "idle");
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current == null) return;
    saveNote(slug, pending.current);
    pending.current = null;
    setState("saved");
  };

  // Save whatever is pending when leaving the tab or the problem.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (value: string) => {
    setText(value);
    pending.current = value;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  return (
    <div className="flex h-full flex-col p-5">
      <PanelTitle
        icon={<NotebookPen className="h-4 w-4 text-primary" />}
        right={
          <span
            className="flex items-center gap-1 text-[11px] text-muted-foreground"
            aria-live="polite"
          >
            {state === "saving" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Saving
              </>
            ) : state === "saved" ? (
              <>
                <Check className="h-3 w-3 text-success" /> Saved
                {stored?.updatedAt ? ` · ${timeAgo(stored.updatedAt)}` : ""}
              </>
            ) : null}
          </span>
        }
      >
        Notes
      </PanelTitle>
      <p className="mt-1 text-xs text-muted-foreground">
        {enabled
          ? "Private to you. Saved in this browser and synced to your account when signed in."
          : "Private to you. Saved in this browser."}
      </p>
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        aria-label="Notes for this problem"
        placeholder="Key insight, edge cases you missed, complexity, what to revisit…"
        className="mt-3 min-h-0 flex-1 resize-none bg-muted/20 font-mono text-[13px] leading-relaxed"
      />
    </div>
  );
}
