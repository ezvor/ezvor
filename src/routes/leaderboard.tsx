import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trophy, UserRound } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useHydrated } from "@/lib/progress/hydrated";
import { relativeTime } from "@/lib/progress/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Ezvor" },
      {
        name: "description",
        content:
          "Top Ezvor members by verified solves. Score: Easy 1, Medium 2, Hard 4 points. Only members with public profiles are listed.",
      },
    ],
  }),
  component: LeaderboardPage,
});

type Row = {
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  solved: number;
  easy: number;
  medium: number;
  hard: number;
  score: number;
  last_solved_at: string | null;
};

async function fetchLeaderboard(): Promise<Row[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("handle, display_name, avatar_url, solved, easy, medium, hard, score, last_solved_at")
    .order("score", { ascending: false })
    .order("solved", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((r): r is Row => Boolean(r?.handle));
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function LeaderboardPage() {
  const { user } = useAuth();
  const hydrated = useHydrated();
  const query = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
    enabled: isSupabaseConfigured && hydrated,
    staleTime: 60_000,
  });

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Leaderboard"
        title="Top solvers"
        description="Ranked by server-verified solves: Easy 1 point, Medium 2, Hard 4. Only members who made their profile public appear here."
      />

      <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-8">
        {!isSupabaseConfigured ? (
          <EmptyState
            title="Accounts are not enabled on this deployment"
            body="This instance of Ezvor runs in local-only mode: your progress stays in your browser and there is no shared leaderboard. Your own stats are on the Progress page."
            action={
              <Link to="/progress" className="text-sm font-medium hover:underline">
                View your progress
              </Link>
            }
          />
        ) : query.isPending ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading leaderboard
          </div>
        ) : query.isError ? (
          <EmptyState
            title="Could not load the leaderboard"
            body={query.error.message}
            action={
              <button
                onClick={() => query.refetch()}
                className="text-sm font-medium hover:underline"
              >
                Try again
              </button>
            }
          />
        ) : query.data.length === 0 ? (
          <EmptyState
            title="No one is ranked yet"
            body="Solve problems while signed in and make your profile public to appear here."
            action={
              user ? (
                <Link to="/problems" className="text-sm font-medium hover:underline">
                  Browse problems
                </Link>
              ) : (
                <Link to="/auth" className="text-sm font-medium hover:underline">
                  Sign in
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="w-14 px-3 py-2.5 text-left font-medium">
                    Rank
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">
                    Member
                  </th>
                  <th
                    scope="col"
                    className="hidden px-3 py-2.5 text-right font-medium sm:table-cell"
                  >
                    E / M / H
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Solved
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((r, i) => {
                  const name = r.display_name || r.handle || "Member";
                  return (
                    <tr key={r.handle} className="border-t border-border/40">
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                            i === 0
                              ? "bg-warning/20 text-warning"
                              : i < 3
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground",
                          )}
                        >
                          {i === 0 ? <Trophy className="h-3.5 w-3.5" aria-label="1" /> : i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          to="/p/$handle"
                          params={{ handle: r.handle! }}
                          className="flex min-w-0 items-center gap-2.5 hover:underline"
                        >
                          <Avatar className="h-7 w-7 shrink-0">
                            {r.avatar_url && <AvatarImage src={r.avatar_url} alt="" />}
                            <AvatarFallback className="bg-muted text-[10px]">
                              {initials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{name}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              @{r.handle}
                              {hydrated && r.last_solved_at && (
                                <> · active {relativeTime(new Date(r.last_solved_at).getTime())}</>
                              )}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-3 py-2.5 text-right text-xs tabular-nums sm:table-cell">
                        <span className="text-success">{r.easy}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-warning">{r.medium}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-destructive">{r.hard}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.solved}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {r.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/70 px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserRound className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
