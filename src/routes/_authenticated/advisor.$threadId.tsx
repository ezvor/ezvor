import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Loader2,
  Copy,
  Check,
  Compass,
  LogOut,
  ArrowUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getMessages, saveExchange } from "@/lib/threads.functions";
import advisorOrb from "@/assets/advisor-orb.png";

export const Route = createFileRoute("/_authenticated/advisor/$threadId")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: ChatPage,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  { icon: "🎯", text: "How do I get selected for GSoC 2025?" },
  { icon: "🧭", text: "Give me a roadmap to become an ML engineer" },
  { icon: "🚀", text: "Best opportunities for a 2nd-year CS student in Pakistan" },
  { icon: "🏆", text: "How to start competitive programming for ICPC?" },
  { icon: "☁️", text: "DevOps career path with free YouTube resources" },
  { icon: "📊", text: "Skills I need to become a Data Architect" },
];

function ChatPage() {
  const { threadId } = Route.useParams();
  const { q } = Route.useSearch();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef(false);
  const autoSentRef = useRef(false);

  const { data } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => getMessages({ data: { threadId } }),
  });

  // Load persisted messages when the thread changes (but never mid-stream).
  useEffect(() => {
    if (!data || streamingRef.current) return;
    setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
  }, [data]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Auto-grow the composer.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  const meta = user?.user_metadata ?? {};
  const displayName: string =
    meta.display_name || meta.full_name || meta.name || user?.email?.split("@")[0] || "You";
  const avatarUrl: string | undefined = meta.avatar_url || meta.picture;
  const initials = displayName
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    streamingRef.current = true;

    let assistant = "";
    const pushAssistant = (chunk: string) => {
      assistant += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === "assistant"
          ? prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistant } : m))
          : [...prev, { role: "assistant", content: assistant }];
      });
    };

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.error ?? "Something went wrong");
      }

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

      if (assistant.trim()) {
        await saveExchange({
          data: { threadId, userContent: content, assistantContent: assistant },
        });
        queryClient.invalidateQueries({ queryKey: ["threads"] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
      streamingRef.current = false;
    }
  };

  // Auto-send a prompt that arrived via the URL (e.g. a "Popular" chip on the
  // home page). Fire once, then strip ?q from the URL so a refresh won't resend.
  useEffect(() => {
    if (!q || autoSentRef.current) return;
    if (streamingRef.current || loading) return;
    // Wait until persisted messages have loaded so we don't double up.
    if (!data) return;
    autoSentRef.current = true;
    navigate({
      to: "/advisor/$threadId",
      params: { threadId },
      search: {},
      replace: true,
    });
    send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, data]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-gradient-hero px-4 py-3 pl-16">
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center">
            <img
              src={advisorOrb}
              alt="AI advisor"
              width={36}
              height={36}
              className="h-9 w-9 drop-shadow-[0_0_12px_oklch(0.6_0.2_280/0.6)]"
            />
          </span>
          <div>
            <h1 className="font-display text-sm font-bold leading-tight">AI Career Advisor</h1>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Online · high-accuracy answers
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full border border-border/60 bg-card/70 py-1 pl-1 pr-3 transition-colors hover:bg-card">
              <Avatar className="h-7 w-7">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-gradient-primary text-xs text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-xs font-medium sm:inline">
                {displayName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {isEmpty ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center pt-6 text-center"
            >
              <motion.img
                src={advisorOrb}
                alt="AI advisor"
                width={112}
                height={112}
                className="h-28 w-28 drop-shadow-[0_0_40px_oklch(0.6_0.2_280/0.5)]"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <h2 className="mt-5 font-display text-2xl font-bold">
                Hi {displayName.split(" ")[0]}, where should we start?
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Ask about careers, skills, roadmaps, or real opportunities. I give accurate,
                personalized guidance — and remember every conversation.
              </p>
              <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-2">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={s.text}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    onClick={() => send(s.text)}
                    className="group flex items-center gap-3 rounded-xl border border-border/60 bg-gradient-card p-3.5 text-left text-sm shadow-soft transition-all hover:border-primary/50 hover:shadow-glow"
                  >
                    <span className="text-lg">{s.icon}</span>
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
                          alt="AI"
                          width={32}
                          height={32}
                          className={cn(
                            "h-8 w-8 shrink-0 transition-transform",
                            streaming && "animate-pulse",
                          )}
                        />
                      ) : (
                        <Avatar className="h-8 w-8 shrink-0">
                          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                          <AvatarFallback className="bg-secondary text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed transition-shadow",
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
                  <img src={advisorOrb} alt="AI" width={32} height={32} className="h-8 w-8" />
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border/60 bg-card px-4 py-3.5">
                    <Dot delay={0} />
                    <Dot delay={0.15} />
                    <Dot delay={0.3} />
                  </div>
                </div>
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask anything about your career…"
              disabled={loading}
              className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl bg-gradient-primary shadow-glow"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const text = String(children ?? "");

  if (inline) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  const copy = () => {
    navigator.clipboard.writeText(text.replace(/\n$/, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative my-2">
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
    </div>
  );
}
