import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  User,
  Rocket,
  Plus,
  MessageSquare,
  Trash2,
  History,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type Conversation,
  type ChatMsg,
  createId,
  loadConversations,
  saveConversation,
  deleteConversation,
} from "@/lib/chatHistory";

export const Route = createFileRoute("/advisor")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AI Career Advisor | PathPilot" },
      {
        name: "description",
        content:
          "Chat with PathPilot's AI career advisor for accurate, personalized guidance on careers, skills, opportunities and roadmaps.",
      },
    ],
  }),
  component: AdvisorPage,
});

type Msg = ChatMsg;

const suggestions = [
  "How do I get selected for GSoC?",
  "Roadmap to become an ML engineer",
  "Best opportunities for a 2nd-year CS student",
  "How to start competitive programming for ICPC?",
];

function AdvisorPage() {
  const { q } = Route.useSearch();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>(() => createId());
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  // Load history once on mount (client only).
  useEffect(() => {
    setHistory(loadConversations());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Persist whenever a completed exchange exists.
  const persist = (msgs: Msg[]) => {
    if (msgs.length === 0) return;
    const existing = history.find((c) => c.id === activeId);
    const conv: Conversation = {
      id: activeId,
      title: existing?.title ?? "",
      messages: msgs,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    setHistory(saveConversation(conv));
  };

  const newChat = () => {
    setMessages([]);
    setActiveId(createId());
    setInput("");
    setShowHistory(false);
    sentInitial.current = true; // prevent auto-send re-trigger
  };

  const openConversation = (conv: Conversation) => {
    setMessages(conv.messages);
    setActiveId(conv.id);
    setShowHistory(false);
    sentInitial.current = true;
  };

  const removeConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = deleteConversation(id);
    setHistory(next);
    if (id === activeId) newChat();
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);

    let assistant = "";
    let finalMsgs: Msg[] = next;
    const pushAssistant = (chunk: string) => {
      assistant += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const updated: Msg[] =
          last?.role === "assistant"
            ? prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistant } : m))
            : [...prev, { role: "assistant", content: assistant } as Msg];
        finalMsgs = updated;
        return updated;
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
      persist(finalMsgs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (q && !sentInitial.current) {
      sentInitial.current = true;
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* History sidebar */}
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-border/60 bg-card/95 backdrop-blur transition-transform md:static md:z-auto md:translate-x-0",
          showHistory ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <span className="flex items-center gap-2 font-display text-sm font-semibold">
            <History className="h-4 w-4 text-primary-glow" /> Chat history
          </span>
          <button
            onClick={() => setShowHistory(false)}
            className="text-muted-foreground hover:text-foreground md:hidden"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          <Button onClick={newChat} className="w-full bg-gradient-primary shadow-glow">
            <Plus className="h-4 w-4" /> New chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {history.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Your past conversations will appear here.
            </p>
          ) : (
            history.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className={cn(
                  "group mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  c.id === activeId
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{c.title || "New chat"}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => removeConversation(c.id, e)}
                  onKeyDown={(e) => e.key === "Enter" && removeConversation(c.id, e as unknown as React.MouseEvent)}
                  className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Overlay on mobile when history open */}
      {showHistory && (
        <div
          className="fixed inset-0 z-20 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={() => setShowHistory(false)}
        />
      )}

      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border/60 bg-gradient-hero px-5 py-5 sm:px-8">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button
              onClick={() => setShowHistory(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground md:hidden"
              aria-label="Open history"
            >
              <History className="h-5 w-5" />
            </button>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold">AI Career Advisor</h1>
              <p className="text-xs text-muted-foreground">
                Accurate, personalized guidance — powered by AI
              </p>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.length === 0 && !loading && (
              <div className="rounded-2xl border border-border/60 bg-gradient-card p-6 text-center shadow-soft">
                <Rocket className="mx-auto h-8 w-8 text-primary-glow" />
                <h2 className="mt-3 font-display text-lg font-semibold">
                  Ask me anything about your career
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Careers, skills, opportunities, applications, roadmaps — I've got you.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    m.role === "user"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-gradient-primary text-primary-foreground shadow-glow",
                  )}
                >
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-secondary text-secondary-foreground"
                      : "border border-border/60 bg-card",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose-chat">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 bg-background/80 px-5 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Ask your career question…"
              disabled={loading}
            />
            <Button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="bg-gradient-primary shadow-glow"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
