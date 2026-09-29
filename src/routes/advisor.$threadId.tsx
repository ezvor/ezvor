import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  Compass,
  Copy,
  Loader2,
  LogIn,
  RotateCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth, userIdentity } from "@/hooks/useAuth";
import { getMessages, saveExchange } from "@/lib/threads.functions";
import {
  appendLocalExchange,
  getLocalMessages,
  getLocalThread,
  isLocalThreadId,
} from "@/lib/local/chats";
import advisorOrb from "@/assets/advisor-orb.png";

export const Route = createFileRoute("/advisor/$threadId")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.slice(0, 8000) : undefined,
  }),
  component: ChatPage,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/** A request that failed, kept so the user can retry it. */
interface Failure {
  message: string;
  retryable: boolean;
}

const MAX_INPUT = 8000;
/** The API accepts ≤ 40 messages of ≤ 8000 chars; send the recent window. */
const CONTEXT_MESSAGES = 30;

const suggestions = [
  { icon: "🎯", text: "How do I get selected for Google Summer of Code?" },
  { icon: "🧭", text: "Give me a roadmap to become an ML engineer" },
  { icon: "🧩", text: "Make me a 6-week DSA plan for FAANG interviews" },
  { icon: "🏆", text: "How to start competitive programming for ICPC?" },
  { icon: "☁️", text: "DevOps career path with free resources" },
  { icon: "📄", text: "What should a strong new-grad resume include?" },
];

class ChatError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function errorFromResponse(resp: Response): Promise<ChatError> {
  const body = (await resp.json().catch(() => null)) as { error?: string } | null;
  if (resp.status === 429) {
    const retry = Number(resp.headers.get("Retry-After"));
    const wait =
      retry > 0
        ? ` Try again in ${retry < 90 ? `${retry}s` : `${Math.ceil(retry / 60)} min`}.`
        : "";
    return new ChatError(
      body?.error
        ? `${body.error}${wait && !/try again/i.test(body.error) ? wait : ""}`
        : `You're sending messages quickly.${wait || " Please wait a moment."}`,
      true,
    );
  }
  if (resp.status === 503 || resp.status === 502 || resp.status === 504) {
    return new ChatError(
      body?.error ?? "The AI service is temporarily unavailable. Please try again shortly.",
      true,
    );
  }
  if (resp.status === 403) {
    return new ChatError("This request was blocked. Reload the page and try again.", false);
  }
  return new ChatError(
    body?.error ?? "Something went wrong. Please try again.",
    resp.status >= 500,
  );
}

function ChatPage() {
  const { threadId } = Route.useParams();
  const { q } = Route.useSearch();
  const { user, profile, enabled, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isLocal = isLocalThreadId(threadId);
  const signedIn = enabled && !!user;
  const needsAccount = !isLocal && !authLoading && !signedIn;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [localReady, setLocalReady] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef(false);
  const autoSentRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const remote = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => getMessages({ data: { threadId } }),
    enabled: !isLocal && signedIn,
  });

  // Load persisted messages when the thread changes (but never mid-stream).
  useEffect(() => {
    if (streamingRef.current) return;
    setFailure(null);
    if (isLocal) {
      if (!getLocalThread(threadId)) {
        navigate({ to: "/advisor", replace: true });
        return;
      }
      setMessages(getLocalMessages(threadId).map((m) => ({ role: m.role, content: m.content })));
      setLocalReady(true);
      return;
    }
    setLocalReady(false);
    if (!remote.data) return;
    if (!remote.data.thread) {
      toast.error("That chat no longer exists");
      navigate({ to: "/advisor", replace: true });
      return;
    }
    setMessages(remote.data.messages.map((m) => ({ role: m.role, content: m.content })));
  }, [isLocal, threadId, remote.data, navigate]);

  // Stop any in-flight stream when leaving the thread.
  useEffect(() => () => abortRef.current?.abort(), [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, failure]);

  // Auto-grow the composer.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  const { displayName, avatarUrl, initials } = userIdentity(user, profile);
  const firstName = signedIn ? displayName.split(" ")[0] : null;

  /**
   * Send a message. With `retry`, the last user message is re-sent (it's
   * already in the list and wasn't answered).
   */
  const send = async (text: string, opts: { retry?: boolean } = {}) => {
    if (loading || needsAccount) return;
    let history: Msg[];
    let content: string;
    if (opts.retry) {
      const last = messages[messages.length - 1];
      if (!last || last.role !== "user") return;
      content = last.content;
      history = messages;
    } else {
      content = text.trim().slice(0, MAX_INPUT);
      if (!content) return;
      setInput("");
      history = [...messages, { role: "user", content }];
      setMessages(history);
    }
    setFailure(null);
    setLoading(true);
    streamingRef.current = true;

    let assistant = "";
    let rafId: number | null = null;
    const flush = () => {
      rafId = null;
      if (!assistant) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === "assistant"
          ? prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistant } : m))
          : [...prev, { role: "assistant", content: assistant }];
      });
    };
    // Coalesce tokens into one paint per frame so fast streams stay smooth.
    const pushAssistant = (chunk: string) => {
      assistant += chunk;
      if (rafId == null) {
        rafId =
          typeof requestAnimationFrame !== "undefined"
            ? requestAnimationFrame(flush)
            : (setTimeout(flush, 16) as unknown as number);
      }
    };

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = history
        .slice(-CONTEXT_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_INPUT) }))
        .filter((m) => m.content.trim());
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) throw await errorFromResponse(resp);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) pushAssistant(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (rafId != null && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(rafId);
      flush();

      if (!assistant.trim()) {
        throw new ChatError("The AI returned an empty answer. Please try again.", true);
      }

      if (isLocal) {
        appendLocalExchange(threadId, content, assistant);
      } else {
        try {
          await saveExchange({
            data: {
              threadId,
              userContent: content.slice(0, 12_000),
              assistantContent: assistant.slice(0, 40_000),
            },
          });
          queryClient.invalidateQueries({ queryKey: ["threads"] });
        } catch {
          toast.error("Couldn't save this reply to your account.");
        }
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      if (rafId != null && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(rafId);
      // Drop a partial answer so "Retry" re-asks cleanly.
      if (assistant) {
        setMessages((prev) =>
          prev[prev.length - 1]?.role === "assistant" ? prev.slice(0, -1) : prev,
        );
      }
      const err =
        e instanceof ChatError
          ? e
          : new ChatError(
              e instanceof TypeError
                ? "Couldn't reach Ezvor. Check your connection and try again."
                : "Something went wrong. Please try again.",
              true,
            );
      setFailure({ message: err.message, retryable: err.retryable });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
      streamingRef.current = false;
    }
  };

  const ready = isLocal ? localReady : !!remote.data;

  // Auto-send a prompt that arrived via the URL (e.g. the home page's quick-ask
  // box). Fire once, then strip ?q so a refresh won't resend.
  useEffect(() => {
    if (!q || autoSentRef.current || !ready) return;
    if (streamingRef.current || loading) return;
    autoSentRef.current = true;
    navigate({ to: "/advisor/$threadId", params: { threadId }, search: {}, replace: true });
    void send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ready]);

  if (needsAccount) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <LogIn className="h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-xl font-bold">This chat is saved to an account</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sign in to open it, or start a new chat on this device.
        </p>
        <div className="mt-2 flex gap-2">
          <Button asChild className="bg-gradient-primary shadow-glow">
            <Link to="/auth" search={{ redirect: `/advisor/${threadId}` }}>
              Sign in
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/advisor">New chat</Link>
          </Button>
        </div>
      </div>
    );
  }

  const lastIsUnanswered = messages[messages.length - 1]?.role === "user";
  const isEmpty = messages.length === 0 && !loading;
  const loadingHistory = !isLocal && (authLoading || remote.isLoading);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-gradient-hero px-4 py-3 pl-16">
        <div className="flex items-center gap-3">
          <img
            src={advisorOrb}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 drop-shadow-[0_0_12px_oklch(0.6_0.2_280/0.6)]"
          />
          <div>
            <h1 className="font-display text-sm font-bold leading-tight">AI Career Advisor</h1>
            <span className="text-[11px] text-muted-foreground">
              {isLocal ? "Saved on this device" : "Saved to your account"}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8" aria-live="polite">
        <div className="mx-auto max-w-3xl">
          {loadingHistory ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : remote.isError && !isLocal ? (
            <ErrorRow
              message="Couldn't load this conversation."
              action={
                <Button size="sm" variant="secondary" onClick={() => void remote.refetch()}>
                  <RotateCcw className="h-3.5 w-3.5" /> Try again
                </Button>
              }
            />
          ) : isEmpty ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center pt-6 text-center"
            >
              <motion.img
                src={advisorOrb}
                alt=""
                width={112}
                height={112}
                className="h-28 w-28 drop-shadow-[0_0_40px_oklch(0.6_0.2_280/0.5)]"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <h2 className="mt-5 font-display text-2xl font-bold">
                {firstName ? `Hi ${firstName}, where should we start?` : "Where should we start?"}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Ask about careers, skills, interview prep, roadmaps or real opportunities.
              </p>
              <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-2">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={s.text}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    onClick={() => void send(s.text)}
                    className="group flex items-center gap-3 rounded-xl border border-border/60 bg-gradient-card p-3.5 text-left text-sm shadow-soft transition-all hover:border-primary/50 hover:shadow-glow"
                  >
                    <span className="text-lg" aria-hidden>
                      {s.icon}
                    </span>
                    <span className="flex-1 text-foreground/90">{s.text}</span>
                    <ArrowUp className="h-4 w-4 shrink-0 rotate-45 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1;
                  const streaming = loading && isLast && m.role === "assistant";
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        "flex gap-3",
                        m.role === "user" ? "flex-row-reverse" : "flex-row",
                      )}
                    >
                      {m.role === "assistant" ? (
                        <img
                          src={advisorOrb}
                          alt="Advisor"
                          width={32}
                          height={32}
                          className={cn("h-8 w-8 shrink-0", streaming && "animate-pulse")}
                        />
                      ) : (
                        <Avatar className="h-8 w-8 shrink-0">
                          {signedIn && avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                          <AvatarFallback className="bg-secondary text-xs">
                            {signedIn ? initials : "You"}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                          m.role === "user"
                            ? "rounded-tr-sm bg-gradient-primary text-primary-foreground shadow-glow"
                            : "rounded-tl-sm border border-border/60 bg-card",
                        )}
                      >
                        {m.role === "assistant" ? (
                          <div className="prose-chat">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{ code: CodeBlock }}
                            >
                              {m.content}
                            </ReactMarkdown>
                            {streaming && (
                              <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary-glow align-middle" />
                            )}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {loading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex items-center gap-3">
                  <img src={advisorOrb} alt="" width={32} height={32} className="h-8 w-8" />
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border/60 bg-card px-4 py-3.5">
                    <Dot delay={0} />
                    <Dot delay={0.15} />
                    <Dot delay={0.3} />
                  </div>
                </div>
              )}

              {failure && !loading && (
                <ErrorRow
                  message={failure.message}
                  action={
                    failure.retryable && lastIsUnanswered ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void send("", { retry: true })}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    ) : null
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-background/80 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-card p-2 shadow-soft transition-colors focus-within:border-primary/50">
            <textarea
              ref={textareaRef}
              value={input}
              maxLength={MAX_INPUT}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Ask anything about your career…"
              aria-label="Message the advisor"
              disabled={loading}
              className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              onClick={() => void send(input)}
              disabled={loading || !input.trim()}
              size="icon"
              aria-label="Send message"
              className="h-9 w-9 shrink-0 rounded-xl bg-gradient-primary shadow-glow"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <Compass className="h-3 w-3" />
            Ezvor can make mistakes — verify dates & deadlines on official pages.
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorRow({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2 text-foreground/90">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        {message}
      </p>
      {action}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-2 w-2 rounded-full bg-primary-glow"
      animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
      transition={{ duration: 1, repeat: Infinity, delay }}
    />
  );
}

function CodeBlock({
  inline,
  className,
  children,
  ...props
}: {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const text = String(children ?? "");

  if (inline || !text.includes("\n")) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  const copy = () => {
    void navigator.clipboard?.writeText(text.replace(/\n$/, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="group relative my-2 block">
      <button
        onClick={copy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <code className={className} {...props}>
        {children}
      </code>
    </span>
  );
}
