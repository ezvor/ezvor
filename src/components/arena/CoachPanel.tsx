import { ArrowUp, Check, Copy, Eraser, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Textarea } from "@/components/ui/textarea";
import { HINT_PROMPTS, QUICK_ACTIONS, type QuickAction } from "@/lib/coach";
import { cn } from "@/lib/utils";
import { IconBtn } from "./ui";
import type { Coach } from "./useCoach";

function CodePre({ children, node: _node, ...props }: ComponentProps<"pre"> & { node?: unknown }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Copy code"
        onClick={() => {
          void navigator.clipboard?.writeText(ref.current?.innerText.replace(/\n$/, "") ?? "");
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded-md bg-background/70 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre ref={ref} {...props}>
        {children}
      </pre>
    </div>
  );
}

const MD_COMPONENTS = { pre: CodePre };

export function CoachPanel({
  coach,
  hasFailure,
  problemTitle,
}: {
  coach: Coach;
  /** A failing Run/Submit exists, so "Why is my code failing?" has something to explain. */
  hasFailure: boolean;
  problemTitle: string;
}) {
  const { messages, streaming, hintLevel, send, stop, clear } = coach;
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  // Follow the stream unless the user scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const runAction = (a: QuickAction) => {
    stickRef.current = true;
    send(a.intent, a.intent === "hint" ? HINT_PROMPTS[hintLevel] : a.prompt);
  };

  const submit = () => {
    if (!input.trim() || streaming) return;
    stickRef.current = true;
    send("chat", input);
    setInput("");
  };

  const actionLabel = (a: QuickAction) => (a.intent === "hint" ? `Hint ${hintLevel}/3` : a.label);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="font-display text-sm font-bold">AI Coach</h2>
          <span className="truncate text-xs text-muted-foreground">{problemTitle}</span>
        </div>
        {messages.length > 0 && (
          <IconBtn label="Clear conversation" onClick={clear}>
            <Eraser className="h-3.5 w-3.5" />
          </IconBtn>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="mx-auto max-w-sm pt-4 text-center">
            <p className="font-display text-base font-semibold">Stuck? Ask the coach.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              It sees this problem, your code and your last failing test. Hints start small and get
              more specific each time you ask.
            </p>
            <div className="mt-5 grid gap-2">
              {QUICK_ACTIONS.map((a) => {
                const disabled = a.intent === "debug" && !hasFailure;
                return (
                  <button
                    key={a.intent}
                    type="button"
                    disabled={disabled}
                    title={disabled ? "Run or submit your code first" : undefined}
                    onClick={() => runAction(a)}
                    className="rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLabel(a)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => {
              const last = i === messages.length - 1;
              return m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary/15 px-3.5 py-2 text-sm text-foreground">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="prose-chat min-w-0">
                  {m.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="inline-flex items-center gap-1 py-1" aria-label="Thinking">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
                    </span>
                  )}
                  {last && streaming && m.content && (
                    <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary align-middle" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border/60 p-3">
        {messages.length > 0 && (
          <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
            {QUICK_ACTIONS.map((a) => {
              const disabled = streaming || (a.intent === "debug" && !hasFailure);
              return (
                <button
                  key={a.intent}
                  type="button"
                  disabled={disabled}
                  onClick={() => runAction(a)}
                  className="shrink-0 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLabel(a)}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-card p-1.5 transition-colors focus-within:border-primary/50">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={4000}
            aria-label="Ask the coach"
            placeholder="Ask about this problem…"
            className="max-h-32 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop generating"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground hover:bg-muted/80"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim()}
              aria-label="Send"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                input.trim()
                  ? "bg-gradient-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          AI-generated answers can be wrong. Verify them by running your code.
        </p>
      </div>
    </div>
  );
}
