import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { createThread, listThreads } from "@/lib/threads.functions";
import { createLocalThread, listLocalThreads } from "@/lib/local/chats";

export const Route = createFileRoute("/advisor/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.slice(0, 8000) : undefined,
  }),
  component: AdvisorIndex,
});

/** Opens the most recent chat, or starts one (carrying `?q=` from the home page). */
function AdvisorIndex() {
  const navigate = useNavigate();
  const { q } = Route.useSearch();
  const { user, enabled, loading: authLoading } = useAuth();
  const signedIn = enabled && !!user;
  const ran = useRef(false);

  const { data: threads, isError } = useQuery({
    queryKey: ["threads", user?.id ?? null],
    queryFn: () => listThreads(),
    enabled: signedIn,
  });

  useEffect(() => {
    if (ran.current || authLoading) return;

    const open = (threadId: string, withQ = false) =>
      navigate({
        to: "/advisor/$threadId",
        params: { threadId },
        search: withQ && q ? { q } : {},
        replace: true,
      });

    const openLocal = (withQ: boolean) => {
      const recent = listLocalThreads()[0];
      open(withQ || !recent ? createLocalThread(withQ ? q : undefined).id : recent.id, withQ);
    };

    if (!signedIn) {
      ran.current = true;
      openLocal(!!q);
      return;
    }

    // Signed in but the database is unreachable: fall back to a device chat.
    if (isError) {
      ran.current = true;
      openLocal(!!q);
      return;
    }

    if (q) {
      ran.current = true;
      createThread({ data: { title: q } })
        .then((t) => open(t.id, true))
        .catch(() => openLocal(true));
      return;
    }

    if (!threads) return;
    ran.current = true;
    if (threads.length > 0) {
      open(threads[0].id);
    } else {
      createThread({ data: {} })
        .then((t) => open(t.id))
        .catch(() => openLocal(false));
    }
  }, [authLoading, signedIn, threads, isError, navigate, q]);

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
