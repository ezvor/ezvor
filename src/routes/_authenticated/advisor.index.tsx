import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { listThreads, createThread } from "@/lib/threads.functions";

export const Route = createFileRoute("/_authenticated/advisor/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: AdvisorIndex,
});

function AdvisorIndex() {
  const navigate = useNavigate();
  const { q } = Route.useSearch();
  const ran = useRef(false);

  const { data: threads } = useQuery({
    queryKey: ["threads"],
    queryFn: () => listThreads(),
  });

  useEffect(() => {
    if (ran.current) return;

    // A prompt was passed in (e.g. from a "Popular" chip on the home page):
    // always spin up a brand-new chat and carry the prompt into it.
    if (q) {
      ran.current = true;
      createThread({ data: { title: q.slice(0, 60) } })
        .then((t) =>
          navigate({
            to: "/advisor/$threadId",
            params: { threadId: t.id },
            search: { q },
            replace: true,
          }),
        )
        .catch(() => {
          ran.current = false;
        });
      return;
    }

    if (!threads) return;
    ran.current = true;

    if (threads.length > 0) {
      navigate({
        to: "/advisor/$threadId",
        params: { threadId: threads[0].id },
        replace: true,
      });
    } else {
      createThread({ data: {} })
        .then((t) =>
          navigate({ to: "/advisor/$threadId", params: { threadId: t.id }, replace: true }),
        )
        .catch(() => {
          ran.current = false;
        });
    }
  }, [threads, navigate, q]);

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
