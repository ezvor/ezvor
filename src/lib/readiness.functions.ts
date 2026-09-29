// Server functions for the Readiness Engine, account profile settings and
// public proof profiles.
//
// Signed-in reads/writes go through requireSupabaseAuth, so RLS scopes every
// query to auth.uid(). Solved problems are written only by the trusted judge
// (src/lib/judge.functions.ts); nothing here lets a client record a solve.
// The public proof reader uses a publishable-key (anon) client, so it can only
// ever see what the "public read" RLS policies expose.

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { ROADMAPS } from "@/data/careerData";
import {
  HANDLE_RE,
  computeReadiness,
  normalizeGithub,
  normalizeLinkedin,
  type ReadinessResult,
  type SolvedRow,
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

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

// ---- Set / update the user's career target ----
export const setTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        roadmapId: z.string().min(1).max(80),
        roleLabel: z.string().min(1).max(120),
        company: optionalText(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!roadmapById(data.roadmapId)) throw new Error("Unknown roadmap");
    const { supabase, userId } = context;
    const { error } = await supabase.from("career_targets").upsert(
      {
        user_id: userId,
        roadmap_id: data.roadmapId,
        role_label: data.roleLabel,
        company: data.company || null,
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
  .validator((input) =>
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

// ---- Everything the readiness dashboard needs, in one call ----
export const getProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressBundle> => {
    const { supabase, userId } = context;

    const [targetRes, solvedRes, progressRes] = await Promise.all([
      supabase
        .from("career_targets")
        .select("roadmap_id, role_label, company")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("solved_problems")
        .select("problem_id, problem_title, difficulty, topic, language, solved_at")
        .eq("user_id", userId)
        .order("solved_at", { ascending: false })
        .limit(5000),
      supabase
        .from("roadmap_progress")
        .select("item, completed_at")
        .eq("user_id", userId)
        .limit(2000),
    ]);

    const target: TargetDTO | null = targetRes.data
      ? {
          roadmapId: targetRes.data.roadmap_id,
          roleLabel: targetRes.data.role_label,
          company: targetRes.data.company,
        }
      : null;

    const solved = solvedRes.data ?? [];
    const completedItems = (progressRes.data ?? []).map((p) => p.item);

    const readiness = computeReadiness(
      roadmapById(target?.roadmapId),
      solved as SolvedRow[],
      new Set(completedItems),
    );

    return { target, solved, completedItems, readiness };
  });

/* ------------------------------------------------------------ profiles */

export interface MyProfile {
  displayName: string | null;
  avatarUrl: string | null;
  handle: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  github: string | null;
  linkedin: string | null;
  isPublic: boolean;
  /** Whether this deployment can fully delete accounts (service role configured). */
  canDeleteAccount: boolean;
}

function takenMessage(message: string) {
  return /profiles_handle_key|duplicate key/i.test(message)
    ? "That username is taken."
    : message.includes("check constraint")
      ? "One of the fields is invalid."
      : "Couldn't save your profile. Please try again.";
}

// ---- Update the signed-in user's profile ----
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        displayName: optionalText(80),
        handle: z
          .string()
          .trim()
          .regex(HANDLE_RE, "3–30 letters, numbers, - or _")
          .nullable()
          .optional(),
        headline: optionalText(160),
        location: optionalText(80),
        bio: optionalText(600),
        github: optionalText(200),
        linkedin: optionalText(200),
        isPublic: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabase, userId } = context;

    type Patch = Database["public"]["Tables"]["profiles"]["Update"];
    const patch: Patch = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName || null;
    if (data.handle !== undefined) patch.handle = data.handle || null;
    if (data.headline !== undefined) patch.headline = data.headline || null;
    if (data.location !== undefined) patch.location = data.location || null;
    if (data.bio !== undefined) patch.bio = data.bio || null;
    if (data.github !== undefined) {
      const gh = normalizeGithub(data.github);
      if (data.github && !gh) return { ok: false, error: "That GitHub username looks invalid." };
      patch.github = gh;
    }
    if (data.linkedin !== undefined) {
      const li = normalizeLinkedin(data.linkedin);
      if (data.linkedin && !li) return { ok: false, error: "That LinkedIn profile looks invalid." };
      patch.linkedin = li;
    }
    if (data.isPublic !== undefined) patch.is_public = data.isPublic;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, handle")
      .eq("user_id", userId)
      .maybeSingle();

    const finalHandle = patch.handle !== undefined ? patch.handle : existing?.handle;
    if (patch.is_public && !finalHandle) {
      return { ok: false, error: "Pick a username before making your profile public." };
    }

    // Older accounts (created before the signup trigger) may not have a row yet.
    const { error } = existing
      ? await supabase.from("profiles").update(patch).eq("user_id", userId)
      : await supabase.from("profiles").insert({ ...patch, user_id: userId });
    if (error) return { ok: false, error: takenMessage(error.message) };
    return { ok: true };
  });

// ---- Current user's own profile (settings + publish panel) ----
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabase, userId } = context;
    const { isAdminConfigured } = await import("@/integrations/supabase/client.server");
    const { data } = await supabase
      .from("profiles")
      .select(
        "display_name, avatar_url, handle, headline, location, bio, github, linkedin, is_public",
      )
      .eq("user_id", userId)
      .maybeSingle();
    return {
      displayName: data?.display_name ?? null,
      avatarUrl: data?.avatar_url ?? null,
      handle: data?.handle ?? null,
      headline: data?.headline ?? null,
      location: data?.location ?? null,
      bio: data?.bio ?? null,
      github: data?.github ?? null,
      linkedin: data?.linkedin ?? null,
      isPublic: data?.is_public ?? false,
      canDeleteAccount: isAdminConfigured(),
    };
  });

/** Escape LIKE wildcards so handles match literally (`_` is a wildcard). */
function likeLiteral(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---- Is a username free? (case-insensitive, like the unique index) ----
export const checkHandle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ handle: z.string().trim().max(40) }).parse(input))
  .handler(async ({ data, context }): Promise<{ available: boolean; reason?: string }> => {
    if (!HANDLE_RE.test(data.handle)) {
      return { available: false, reason: "Use 3–30 letters, numbers, - or _." };
    }
    // The service role sees private profiles too, so the answer is accurate;
    // without it we can only check public profiles (the save still enforces
    // uniqueness). Only a boolean ever leaves the server.
    const { isAdminConfigured, supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const client = isAdminConfigured() ? supabaseAdmin : context.supabase;
    const { data: rows, error } = await client
      .from("profiles")
      .select("user_id")
      .ilike("handle", likeLiteral(data.handle))
      .limit(2);
    if (error) return { available: true };
    const takenByOther = (rows ?? []).some((r) => r.user_id !== context.userId);
    return takenByOther
      ? { available: false, reason: "That username is taken." }
      : { available: true };
  });

// ---- Delete the signed-in user's cloud data (optionally the whole account) ----
export const deleteMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ deleteAccount: z.boolean().default(false) }).parse(input ?? {}))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; accountDeleted: boolean; failed: string[] }> => {
      const { supabase, userId } = context;
      const { isAdminConfigured, supabaseAdmin } =
        await import("@/integrations/supabase/client.server");

      if (data.deleteAccount) {
        if (!isAdminConfigured())
          throw new Error("Account deletion isn't available on this deployment.");
        // Every table references auth.users with ON DELETE CASCADE.
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw new Error("Couldn't delete your account. Please try again.");
        return { ok: true, accountDeleted: true, failed: [] };
      }

      const failed: string[] = [];
      const run = async (label: string, op: PromiseLike<{ error: { message: string } | null }>) => {
        const { error } = await op;
        if (error) failed.push(label);
      };
      await Promise.all([
        run("synced data", supabase.from("user_data").delete().eq("user_id", userId)),
        run("chats", supabase.from("chat_threads").delete().eq("user_id", userId)),
        run("solved problems", supabase.from("solved_problems").delete().eq("user_id", userId)),
        run("roadmap progress", supabase.from("roadmap_progress").delete().eq("user_id", userId)),
        run("career target", supabase.from("career_targets").delete().eq("user_id", userId)),
      ]);
      // Submissions are judge-written (no client delete grant); remove them with
      // the service role, strictly scoped to the verified caller.
      if (isAdminConfigured()) {
        await run(
          "submissions",
          supabaseAdmin.from("code_submissions").delete().eq("user_id", userId),
        );
      }
      // Nothing left to show publicly.
      await supabase.from("profiles").update({ is_public: false }).eq("user_id", userId);
      return { ok: failed.length === 0, accountDeleted: false, failed };
    },
  );

/* --------------------------------------------------- public proof page */

export interface PublicSolve {
  slug: string;
  title: string;
  difficulty: string;
  topic: string | null;
  language: string | null;
  solvedAt: string;
}

export interface PublicProof {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  github: string | null;
  linkedin: string | null;
  memberSince: string;
  target: TargetDTO | null;
  readiness: ReadinessResult;
  counts: { total: number; easy: number; medium: number; hard: number };
  topics: { topic: string; count: number }[];
  /** YYYY-MM-DD (UTC) → problems first solved that day, last 365 days. */
  solvedDays: Record<string, number>;
  recent: PublicSolve[];
  completedItems: string[];
}

function publicClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  // Anonymous client on purpose: RLS only exposes opted-in (public) profiles.
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// ---- Public proof page (no auth). Reads only public data. ----
export const getPublicProof = createServerFn({ method: "GET" })
  .validator((input) => z.object({ handle: z.string().trim().min(1).max(40) }).parse(input))
  .handler(async ({ data }): Promise<PublicProof | null> => {
    if (!HANDLE_RE.test(data.handle)) return null;
    const supabase = publicClient();
    if (!supabase) return null;

    const { data: profiles } = await supabase
      .from("profiles")
      .select(
        "user_id, display_name, avatar_url, handle, headline, location, bio, github, linkedin, is_public, created_at",
      )
      .ilike("handle", likeLiteral(data.handle))
      .eq("is_public", true)
      .limit(2);
    const profile = (profiles ?? []).find(
      (p) => p.is_public && p.handle?.toLowerCase() === data.handle.toLowerCase(),
    );
    if (!profile?.handle) return null;
    const uid = profile.user_id;

    const [targetRes, solvedRes, progressRes] = await Promise.all([
      supabase
        .from("career_targets")
        .select("roadmap_id, role_label, company")
        .eq("user_id", uid)
        .maybeSingle(),
      supabase
        .from("solved_problems")
        .select("problem_id, problem_title, difficulty, topic, language, solved_at")
        .eq("user_id", uid)
        .order("solved_at", { ascending: false })
        .limit(5000),
      supabase.from("roadmap_progress").select("item").eq("user_id", uid).limit(2000),
    ]);

    const target: TargetDTO | null = targetRes.data
      ? {
          roadmapId: targetRes.data.roadmap_id,
          roleLabel: targetRes.data.role_label,
          company: targetRes.data.company,
        }
      : null;

    const solved = solvedRes.data ?? [];
    const completedItems = (progressRes.data ?? []).map((p) => p.item);
    const readiness = computeReadiness(
      roadmapById(target?.roadmapId),
      solved.map((s) => ({ difficulty: s.difficulty, solved_at: s.solved_at })),
      new Set(completedItems),
    );

    const counts = { total: solved.length, easy: 0, medium: 0, hard: 0 };
    const topicCounts = new Map<string, number>();
    const solvedDays: Record<string, number> = {};
    const cutoff = Date.now() - 365 * 86_400_000;
    for (const s of solved) {
      const d = s.difficulty.toLowerCase();
      if (d.startsWith("e")) counts.easy++;
      else if (d.startsWith("h")) counts.hard++;
      else counts.medium++;
      if (s.topic) topicCounts.set(s.topic, (topicCounts.get(s.topic) ?? 0) + 1);
      const t = new Date(s.solved_at).getTime();
      if (!Number.isNaN(t) && t >= cutoff) {
        const k = new Date(t).toISOString().slice(0, 10);
        solvedDays[k] = (solvedDays[k] ?? 0) + 1;
      }
    }
    const topics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([topic, count]) => ({ topic, count }));

    return {
      handle: profile.handle,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      headline: profile.headline,
      location: profile.location,
      bio: profile.bio,
      github: profile.github,
      linkedin: profile.linkedin,
      memberSince: profile.created_at,
      target,
      readiness,
      counts,
      topics,
      solvedDays,
      recent: solved.slice(0, 20).map((s) => ({
        slug: s.problem_id,
        title: s.problem_title,
        difficulty: s.difficulty,
        topic: s.topic,
        language: s.language,
        solvedAt: s.solved_at,
      })),
      completedItems: target ? completedItems : [],
    };
  });
