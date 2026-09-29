import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  CloudUpload,
  HardDrive,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  createThread,
  deleteThread,
  importThread,
  listThreads,
  renameThread,
} from "@/lib/threads.functions";
import {
  createLocalThread,
  deleteLocalThread,
  getLocalMessages,
  isLocalThreadId,
  renameLocalThread,
  useLocalThreads,
} from "@/lib/local/chats";

export const Route = createFileRoute("/advisor")({
  // Guest chats live in localStorage and the session is client-side.
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI Career Advisor — Ezvor" },
      {
        name: "description",
        content:
          "Ask Ezvor's free AI career advisor about roadmaps, interview prep, internships and real opportunities. No sign-in required.",
      },
    ],
  }),
  component: AdvisorLayout,
});

type RailThread = { id: string; title: string; local: boolean };

function AdvisorLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, enabled, loading: authLoading } = useAuth();
  const signedIn = enabled && !!user;
  const localThreads = useLocalThreads();
  const activeThreadId = useActiveThreadId();

  const [railOpen, setRailOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const threadsQuery = useQuery({
    queryKey: ["threads", user?.id ?? null],
    queryFn: () => listThreads(),
    enabled: signedIn,
  });

  const accountThreads: RailThread[] = (threadsQuery.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    local: false,
  }));
  const deviceThreads: RailThread[] = localThreads.map((t) => ({
    id: t.id,
    title: t.title,
    local: true,
  }));
  const refreshThreads = () => queryClient.invalidateQueries({ queryKey: ["threads"] });

  const handleNew = async () => {
    if (!signedIn) {
      const t = createLocalThread();
      navigate({ to: "/advisor/$threadId", params: { threadId: t.id } });
      return;
    }
    setBusy(true);
    try {
      const thread = await createThread({ data: {} });
      await refreshThreads();
      navigate({ to: "/advisor/$threadId", params: { threadId: thread.id } });
    } catch {
      toast.error("Could not start a new chat");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (t: RailThread) => {
    try {
      if (t.local) deleteLocalThread(t.id);
      else {
        await deleteThread({ data: { threadId: t.id } });
        await refreshThreads();
      }
      if (t.id === activeThreadId) navigate({ to: "/advisor" });
    } catch {
      toast.error("Could not delete chat");
    }
  };

  const commitEdit = async (t: RailThread) => {
    const title = editValue.trim().slice(0, 80);
    setEditingId(null);
    if (!title || title === t.title) return;
    try {
      if (t.local) renameLocalThread(t.id, title);
      else {
        await renameThread({ data: { threadId: t.id, title } });
        await refreshThreads();
      }
    } catch {
      toast.error("Could not rename chat");
    }
  };

  // Move this device's guest chats into the account, oldest first.
  const handleImport = async () => {
    setImporting(true);
    let imported = 0;
    let firstId: string | null = null;
    const activeWasLocal = !!activeThreadId && isLocalThreadId(activeThreadId);
    try {
      for (const t of [...localThreads].reverse()) {
        const messages = getLocalMessages(t.id)
          .slice(-200)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 40_000), at: m.at }))
          .filter((m) => m.content.trim());
        if (!messages.length) {
          deleteLocalThread(t.id);
          continue;
        }
        const row = await importThread({
          data: { title: t.title, createdAt: t.createdAt, updatedAt: t.updatedAt, messages },
        });
        if (t.id === activeThreadId) firstId = row.id;
        deleteLocalThread(t.id);
        imported++;
      }
      await refreshThreads();
      toast.success(
        imported
          ? `Imported ${imported} chat${imported === 1 ? "" : "s"} into your account`
          : "Nothing to import",
      );
      if (activeWasLocal) {
        if (firstId) navigate({ to: "/advisor/$threadId", params: { threadId: firstId } });
        else navigate({ to: "/advisor" });
      }
    } catch {
      await refreshThreads();
      toast.error(
        imported
          ? `Imported ${imported} chat${imported === 1 ? "" : "s"}; the rest are still on this device.`
          : "Couldn't import your chats. They're still saved on this device.",
      );
    } finally {
      setImporting(false);
    }
  };

  const renderThread = (t: RailThread) => (
    <div
      key={t.id}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
        t.id === activeThreadId
          ? "bg-primary/15 text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {editingId === t.id ? (
        <div className="flex flex-1 items-center gap-1">
          <Input
            autoFocus
            value={editValue}
            maxLength={80}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitEdit(t);
              if (e.key === "Escape") setEditingId(null);
            }}
            className="h-7 text-sm"
            aria-label="Chat name"
          />
          <button
            onClick={() => void commitEdit(t)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Save name"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => navigate({ to: "/advisor/$threadId", params: { threadId: t.id } })}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="truncate">{t.title || "New chat"}</span>
          </button>
          <button
            onClick={() => {
              setEditingId(t.id);
              setEditValue(t.title);
            }}
            className="opacity-0 transition-opacity hover:text-primary-glow focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="Rename chat"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => void handleDelete(t)}
            className="opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="Delete chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );

  const loadingList = authLoading || (signedIn && threadsQuery.isLoading);
  const primary = signedIn ? accountThreads : deviceThreads;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <AnimatePresence initial={false}>
        {railOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex shrink-0 flex-col overflow-hidden border-r border-border/60 bg-card/60 backdrop-blur"
          >
            <div className="flex h-full w-[280px] flex-col overflow-hidden">
              <div className="p-3">
                <Button
                  onClick={() => void handleNew()}
                  disabled={busy || authLoading}
                  className="w-full gap-2 bg-gradient-primary shadow-glow"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  New chat
                </Button>
              </div>

              {signedIn && deviceThreads.length > 0 && (
                <div className="mx-3 mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                  <p className="text-muted-foreground">
                    {deviceThreads.length} chat{deviceThreads.length === 1 ? " is" : "s are"} saved
                    only on this device.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2 h-7 w-full gap-1.5 text-xs"
                    onClick={() => void handleImport()}
                    disabled={importing}
                  >
                    {importing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CloudUpload className="h-3.5 w-3.5" />
                    )}
                    Import into my account
                  </Button>
                </div>
              )}

              <div className="px-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Conversations
              </div>
              <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
                {loadingList ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : primary.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Your conversations will appear here.
                  </p>
                ) : (
                  primary.map(renderThread)
                )}

                {signedIn && deviceThreads.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5 px-2 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <HardDrive className="h-3 w-3" /> On this device
                    </div>
                    {deviceThreads.map(renderThread)}
                  </>
                )}
              </div>

              {!signedIn && enabled && !authLoading && (
                <div className="border-t border-border/60 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
                  Chats are saved in this browser.{" "}
                  <Link
                    to="/auth"
                    search={{ redirect: "/advisor" }}
                    className="font-medium text-primary-glow hover:underline"
                  >
                    Sign in to sync your chats
                  </Link>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <button
          onClick={() => setRailOpen((v) => !v)}
          className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
          aria-label={railOpen ? "Hide conversations" : "Show conversations"}
        >
          {railOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>
        <Outlet />
      </div>
    </div>
  );
}

function useActiveThreadId(): string | undefined {
  // `strict: false` reads params without throwing when the current match isn't
  // the $threadId route. Never wrap a hook in try/catch — a throw mid-hook
  // changes the hook count between renders and corrupts later hooks.
  const params = useParams({ strict: false }) as { threadId?: string };
  return params.threadId;
}
