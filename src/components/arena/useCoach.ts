import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { streamCoach, type CoachFailure, type CoachIntent } from "@/lib/coach";
import type { LangKey } from "@/lib/judge/languages";

export type CoachEntry = { role: "user" | "assistant"; content: string; intent?: CoachIntent };

export type CoachContext = {
  language: LangKey;
  code: string;
  lastResult: CoachFailure | null;
};

const STORE_PREFIX = "ezvor.coach.v1.";
const EMPTY: CoachEntry[] = [];

function loadThread(slug: string): CoachEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORE_PREFIX + slug);
    return raw ? (JSON.parse(raw) as CoachEntry[]) : [];
  } catch {
    return [];
  }
}

function saveThread(slug: string, thread: CoachEntry[]) {
  try {
    if (thread.length)
      window.sessionStorage.setItem(STORE_PREFIX + slug, JSON.stringify(thread.slice(-40)));
    else window.sessionStorage.removeItem(STORE_PREFIX + slug);
  } catch {
    /* storage blocked — history stays in memory */
  }
}

export type Coach = {
  messages: CoachEntry[];
  streaming: boolean;
  /** Next hint level (1 nudge → 3 approach). */
  hintLevel: 1 | 2 | 3;
  send: (intent: CoachIntent, text: string) => void;
  stop: () => void;
  clear: () => void;
};

/**
 * Per-problem coaching thread (kept for the browser session). `getContext` is
 * read at send time so the coach always sees the latest code and result.
 */
export function useCoach(slug: string, getContext: () => CoachContext): Coach {
  // Tagged with its slug so a switch never saves one problem's thread under another.
  const [thread, setThread] = useState<{ slug: string; messages: CoachEntry[] }>({
    slug: "",
    messages: [],
  });
  const messages = thread.slug === slug ? thread.messages : EMPTY;
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const ctxRef = useRef(getContext);
  ctxRef.current = getContext;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    setThread({ slug, messages: loadThread(slug) });
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      setStreaming(false);
    };
  }, [slug]);

  useEffect(() => {
    if (thread.slug && !streaming) saveThread(thread.slug, thread.messages);
  }, [thread, streaming]);

  const hintsGiven = messages.filter((m) => m.role === "user" && m.intent === "hint").length;
  const hintLevel = Math.min(3, hintsGiven + 1) as 1 | 2 | 3;

  const send = useCallback(
    (intent: CoachIntent, text: string) => {
      const content = text.trim();
      if (!content || abortRef.current) return;
      const ctx = ctxRef.current();
      const prior = messagesRef.current;
      const level = Math.min(
        3,
        prior.filter((m) => m.role === "user" && m.intent === "hint").length + 1,
      ) as 1 | 2 | 3;
      const history: CoachEntry[] = [...prior, { role: "user", content, intent }];
      // Updates only ever touch this problem's thread, even if the user switches mid-stream.
      const update = (fn: (prev: CoachEntry[]) => CoachEntry[]) =>
        setThread((t) => (t.slug === slug ? { slug, messages: fn(t.messages) } : t));
      setThread({ slug, messages: [...history, { role: "assistant", content: "" }] });
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let answer = "";
      let raf: number | null = null;
      const setAnswer = (prev: CoachEntry[]) =>
        prev.map((m, i) =>
          i === prev.length - 1 && m.role === "assistant" ? { ...m, content: answer } : m,
        );
      const paint = () => {
        raf = null;
        update(setAnswer);
      };

      streamCoach(
        {
          slug,
          language: ctx.language,
          intent,
          hintLevel: intent === "hint" ? level : undefined,
          code: ctx.code,
          lastResult: intent === "debug" || intent === "chat" ? ctx.lastResult : null,
          messages: history.map(({ role, content: c }) => ({ role, content: c })),
        },
        (chunk) => {
          answer += chunk;
          // One paint per frame keeps fast streams smooth.
          if (raf == null) raf = requestAnimationFrame(paint);
        },
        controller.signal,
      )
        .then(() => {
          if (!answer.trim())
            throw new Error("The coach returned an empty answer. Please try again.");
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          toast.error(e instanceof Error ? e.message : "The coach is unavailable right now.");
        })
        .finally(() => {
          if (raf != null) cancelAnimationFrame(raf);
          // Keep a partial answer when stopped; drop an empty bubble.
          update((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role !== "assistant") return prev;
            return answer.trim() ? setAnswer(prev) : prev.slice(0, -1);
          });
          if (abortRef.current === controller) {
            abortRef.current = null;
            setStreaming(false);
          }
        });
    },
    [slug],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setThread({ slug, messages: [] });
  }, [slug]);

  return { messages, streaming, hintLevel, send, stop, clear };
}
