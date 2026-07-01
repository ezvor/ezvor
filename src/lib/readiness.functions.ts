// Server functions for the Readiness Engine + verifiable proof profiles.
//
// All writes/reads of a signed-in user's activity go through requireSupabaseAuth
// so RLS scopes everything to auth.uid(). The public proof reader uses a
// publishable-key client and relies on the "public profile" RLS policies.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ROADMAPS } from "@/data/careerData";
import {
  computeReadiness,
  type ReadinessResult,
  type SolvedRow,
  type ProgressRow,
} from "@/lib/readiness";

export interface TargetDTO {
  roadmapId: string;
  roleLabel: string;
  company: string | null;
}

export interface ProgressBundle {
  target: TargetDTO | null;
  solved: {
    problem_id: string;
    problem_title: string;
    difficulty: string;
    topic: string | null;
    language: string | null;
    solved_at: string;
  }[];
  completedItems: string[];
  readiness: ReadinessResult;
}

function roadmapById(id: string | undefined) {
  return ROADMAPS.find((r) => r.id === id);
}

// ---- Set / update the user's career target ----
export const setTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        roadmapId: z.string().min(1).max(80),
        roleLabel: z.string().min(1).max(120),
        company: z.string().max(120).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("career_targets").upsert(
      {
        user_id: userId,
        roadmap_id: data.roadmapId,
        role_label: data.roleLabel,
        company: data.company ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Toggle a roadmap skill item as mastered / not ----
export const toggleRoadmapItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        roadmapId: z.string().min(1).max(80),
        stageTitle: z.string().min(1).max(160),
        item: z.string().min(1).max(200),
        done: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.done) {
      const { error } = await supabase.from("roadmap_progress").upsert(
        {
          user_id: userId,
          roadmap_id: data.roadmapId,
          stage_title: data.stageTitle,
          item: data.item,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,roadmap_id,item" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("roadmap_progress")
        .delete()
        .eq("user_id", userId)
        .eq("roadmap_id", data.roadmapId)
        .eq("item", data.item);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---- Record a verified accepted submission from the DSA Arena ----
export const recordSolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        problemId: z.string().min(1).max(120),
        title: z.string().min(1).max(200),
        difficulty: z.string().min(1).max(20),
        topic: z.string().max(80).nullable().optional(),
        language: z.string().max(40).nullable().optional(),
        runtimeMs: z.number().int().nonnegative().nullable().optional(),
        memoryKb: z.number().int().nonnegative().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("solved_problems").upsert(
      {
        user_id: userId,
        problem_id: data.problemId,
        problem_title: data.title,
        difficulty: data.difficulty,
        topic: data.topic ?? null,
        language: data.language ?? null,
        runtime_ms: data.runtimeMs ?? null,
        memory_kb: data.memoryKb ?? null,
        solved_at: new Date().toISOString(),
      },
      { onConflict: "user_id,problem_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Everything the readiness dashboard needs, in one call ----
export const getProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressBundle> => {
    const { supabase, userId } = context;

    const [targetRes, solvedRes, progressRes] = await Promise.all([
      supabase.from("career_targets").select("roadmap_id, role_label, company").eq("user_id", userId).maybeSingle(),
      supabase
        .from("solved_problems")
        .select("problem_id, problem_title, difficulty, topic, language, solved_at")
        .eq("user_id", userId)
        .order("solved_at", { ascending: false }),
      supabase.from("roadmap_progress").select("item, completed_at").eq("user_id", userId),
    ]);

    const target: TargetDTO | null = targetRes.data
      ? {
          roadmapId: targetRes.data.roadmap_id,
          roleLabel: targetRes.data.role_label,
          company: targetRes.data.company,
        }
      : null;

    const solved = solvedRes.data ?? [];
    const progress = progressRes.data ?? [];
    const completedItems = progress.map((p) => p.item);

    const readiness = computeReadiness(
      roadmapById(target?.roadmapId),
      solved as SolvedRow[],
      new Set(completedItems),
    );

    return { target, solved, completedItems, readiness };
  });

// ---- Update the public proof profile settings ----
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        displayName: z.string().max(80).nullable().optional(),
        handle: z
          .string()
          .trim()
          .regex(/^[a-zA-Z0-9_-]{3,30}$/, "3–30 letters, numbers, - or _")
          .nullable()
          .optional(),
        headline: z.string().max(160).nullable().optional(),
        location: z.string().max(80).nullable().optional(),
        isPublic: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabase, userId } = context;

    const patch: {
      updated_at: string;
      display_name?: string | null;
      handle?: string | null;
      headline?: string | null;
      location?: string | null;
      is_public?: boolean;
    } = { updated_at: new Date().toISOString() };
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.handle !== undefined) patch.handle = data.handle;
    if (data.headline !== undefined) patch.headline = data.headline;
    if (data.location !== undefined) patch.location = data.location;
    if (data.isPublic !== undefined) patch.is_public = data.isPublic;

    // Ensure a profile row exists (older accounts may not have one).
    const { data: existing } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    if (!existing) {
      const { error: insErr } = await supabase.from("profiles").insert({ user_id: userId, ...patch });
      if (insErr) return { ok: false, error: insErr.message.includes("profiles_handle_key") ? "That username is taken." : insErr.message };
      return { ok: true };
    }

    const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
    if (error) {
      return {
        ok: false,
        error: error.message.includes("profiles_handle_key") ? "That username is taken." : error.message,
      };
    }
    return { ok: true };
  });

// ---- Current user's own profile settings (for the publish panel) ----
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, handle, headline, location, is_public")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      displayName: data?.display_name ?? null,
      handle: data?.handle ?? null,
      headline: data?.headline ?? null,
      location: data?.location ?? null,
      isPublic: data?.is_public ?? false,
    };
  });

export interface PublicProof {
  handle: string;
  displayName: string | null;
  headline: string | null;
  location: string | null;
  target: TargetDTO | null;
  readiness: ReadinessResult;
  solved: {
    problem_title: string;
    difficulty: string;
    topic: string | null;
    solved_at: string;
  }[];
  completedItems: string[];
}

// ---- Public proof page (no auth). Reads only public profiles. ----
export const getPublicProof = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ handle: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data }): Promise<PublicProof | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, display_name, handle, headline, location, is_public")
      .ilike("handle", data.handle)
      .eq("is_public", true)
      .maybeSingle();

    if (!profile) return null;
    const uid = profile.user_id;

    const [targetRes, solvedRes, progressRes] = await Promise.all([
      supabase.from("career_targets").select("roadmap_id, role_label, company").eq("user_id", uid).maybeSingle(),
      supabase
        .from("solved_problems")
        .select("problem_title, difficulty, topic, solved_at")
        .eq("user_id", uid)
        .order("solved_at", { ascending: false }),
      supabase.from("roadmap_progress").select("item, completed_at").eq("user_id", uid),
    ]);

    const target: TargetDTO | null = targetRes.data
      ? {
          roadmapId: targetRes.data.roadmap_id,
          roleLabel: targetRes.data.role_label,
          company: targetRes.data.company,
        }
      : null;

    const solved = solvedRes.data ?? [];
    const progress = progressRes.data ?? [];
    const completedItems = progress.map((p) => p.item);

    const readiness = computeReadiness(
      roadmapById(target?.roadmapId),
      solved.map((s) => ({ difficulty: s.difficulty, solved_at: s.solved_at })) as SolvedRow[],
      new Set(completedItems),
    );

    return {
      handle: profile.handle as string,
      displayName: profile.display_name,
      headline: profile.headline,
      location: profile.location,
      target,
      readiness,
      solved,
      completedItems,
    };
  });
