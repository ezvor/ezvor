// Server functions for durable submission history + practice streak.
// All scoped to the signed-in user via requireSupabaseAuth (RLS as auth.uid()).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SubmissionRow = {
  id: string;
  status: string;
  language: string;
  passed: number;
  total: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  when: number;
};

export type StreakInfo = {
  current: number;
  longest: number;
  todayCount: number;
  totalDays: number;
  lastActive: string | null;
};

// ---- Record a submission (any status) ----
export const recordSubmissionDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        problemSlug: z.string().min(1).max(200),
        problemTitle: z.string().max(200).nullable().optional(),
        status: z.string().min(1).max(40),
        language: z.string().min(1).max(40),
        passed: z.number().int().nonnegative().default(0),
        total: z.number().int().nonnegative().default(0),
        runtimeMs: z.number().int().nonnegative().nullable().optional(),
        memoryKb: z.number().int().nonnegative().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("code_submissions").insert({
      user_id: userId,
      problem_slug: data.problemSlug,
      problem_title: data.problemTitle ?? null,
      status: data.status,
      language: data.language,
      passed: data.passed,
      total: data.total,
      runtime_ms: data.runtimeMs ?? null,
      memory_kb: data.memoryKb ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- List a user's submissions for one problem ----
export const listSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }): Promise<SubmissionRow[]> => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("code_submissions")
      .select("id, status, language, passed, total, runtime_ms, memory_kb, created_at")
      .eq("user_id", userId)
      .eq("problem_slug", data.slug)
      .order("created_at", { ascending: false })
      .limit(50);
    return (rows ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      language: r.language,
      passed: r.passed,
      total: r.total,
      runtimeMs: r.runtime_ms,
      memoryKb: r.memory_kb,
      when: new Date(r.created_at).getTime(),
    }));
  });

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// ---- Practice streak, computed from all submission days ----
export const getStreak = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StreakInfo> => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("code_submissions")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(2000);

    const days = Array.from(new Set((rows ?? []).map((r) => dayKey(r.created_at)))).sort();
    if (days.length === 0) {
      return { current: 0, longest: 0, todayCount: 0, totalDays: 0, lastActive: null };
    }

    const set = new Set(days);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Current streak: count back from today (or yesterday if not active today).
    let current = 0;
    if (set.has(today) || set.has(yesterday)) {
      const cursor = new Date(set.has(today) ? today : yesterday);
      while (set.has(cursor.toISOString().slice(0, 10))) {
        current += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
    }

    // Longest streak across history.
    let longest = 1;
    let run = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      prev.setUTCDate(prev.getUTCDate() + 1);
      if (prev.toISOString().slice(0, 10) === days[i]) {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 1;
      }
    }

    const todayCount = (rows ?? []).filter((r) => dayKey(r.created_at) === today).length;

    return {
      current,
      longest: Math.max(longest, current),
      todayCount,
      totalDays: days.length,
      lastActive: days[days.length - 1],
    };
  });
