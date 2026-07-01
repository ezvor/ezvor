import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  listThreads,
  createThread,
  deleteThread,
  renameThread,
  ensureProfile,
  type ThreadRow,
} from "@/lib/threads.functions";

export const Route = createFileRoute("/_authenticated/advisor")({
  component: AdvisorLayout,
});

function AdvisorLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [railOpen, setRailOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  const activeThreadId = useActiveThreadId();

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["threads"],
    queryFn: () => listThreads(),
  });

  // Make sure the signed-in user has a profile row (name/avatar backfill).
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata ?? {};
    ensureProfile({
      data: {
        displayName: (meta.display_name || meta.full_name || meta.name) ?? null,
        avatarUrl: (meta.avatar_url || meta.picture) ?? null,
      },
    })
      .then(() => queryClient.invalidateQueries({ queryKey: ["profile"] }))
      .catch(() => {});
  }, [user, queryClient]);

  const handleNew = async () => {
    setBusy(true);
    try {
      const thread = await createThread({ data: {} });
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/advisor/$threadId", params: { threadId: thread.id } });
    } catch {
      toast.error("Could not start a new chat");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteThread({ data: { threadId: id } });
      const next = await queryClient.invalidateQueries({ queryKey: ["threads"] });
      void next;
      if (id === activeThreadId) navigate({ to: "/advisor" });
    } catch {
      toast.error("Could not delete chat");
    }
  };

  const startEdit = (t: ThreadRow) => {
    setEditingId(t.id);
    setEditValue(t.title);
  };

  const commitEdit = async (id: string) => {
    const title = editValue.trim();
    setEditingId(null);
    if (!title) return;
    try {
      await renameThread({ data: { threadId: id, title } });
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
    } catch {
      toast.error("Could not rename chat");
    }
  };

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
            <div className="flex w-[280px] flex-col overflow-hidden">
              <div className="p-3">
                <Button
                  onClick={handleNew}
                  disabled={busy}
                  className="w-full gap-2 bg-gradient-primary shadow-glow"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  New chat
                </Button>
              </div>
              <div className="px-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Conversations
              </div>
              <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : threads.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Your conversations will appear here.
                  </p>
                ) : (
                  threads.map((t) => (
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
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit(t.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-7 text-sm"
                          />
                          <button
                            onClick={() => commitEdit(t.id)}
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
                            onClick={() =>
                              navigate({ to: "/advisor/$threadId", params: { threadId: t.id } })
                            }
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <MessageSquare className="h-4 w-4 shrink-0" />
                            <span className="truncate">{t.title || "New chat"}</span>
                          </button>
                          <button
                            onClick={() => startEdit(t)}
                            className="opacity-0 transition-opacity hover:text-primary-glow group-hover:opacity-100"
                            aria-label="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
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
  try {
    const params = useParams({ from: "/_authenticated/advisor/$threadId" });
    return params.threadId;
  } catch {
    return undefined;
  }
}
