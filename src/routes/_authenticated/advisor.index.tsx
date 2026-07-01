import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { listThreads, createThread } from "@/lib/threads.functions";

export const Route = createFileRoute("/_authenticated/advisor/")({
  component: AdvisorIndex,
});

function AdvisorIndex() {
  const navigate = useNavigate();
  const ran = useRef(false);

  const { data: threads } = useQuery({
    queryKey: ["threads"],
    queryFn: () => listThreads(),
  });

  useEffect(() => {
    if (!threads || ran.current) return;
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
  }, [threads, navigate]);

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
