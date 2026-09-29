// AI advisor chat threads for signed-in users. Every call runs with the
// caller's RLS-scoped client, so users can only ever touch their own rows.
// Guests keep their chats in the browser instead (src/lib/local/chats.ts).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const MAX_USER_MESSAGE = 12_000;
const MAX_ASSISTANT_MESSAGE = 40_000;

export interface ThreadRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

function cleanTitle(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean;
}

/**
 * Make sure the profile row exists and backfill name/avatar from the OAuth
 * provider. New accounts get a row from the signup trigger; this covers
 * accounts created before it existed.
 */
export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        displayName: z.string().trim().max(80).nullable().optional(),
        avatarUrl: z.string().url().max(500).nullable().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ProfileRow | null> => {
    const { supabase, userId } = context;
    const displayName = data.displayName || null;
    const avatarUrl = data.avatarUrl || null;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const patch: { display_name?: string; avatar_url?: string } = {};
      if (!existing.display_name && displayName) patch.display_name = displayName;
      if (!existing.avatar_url && avatarUrl) patch.avatar_url = avatarUrl;
      if (!Object.keys(patch).length) return existing as ProfileRow;
      const { data: updated } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", userId)
        .select("id, user_id, display_name, avatar_url")
        .maybeSingle();
      return (updated ?? existing) as ProfileRow;
    }

    const { data: created, error } = await supabase
      .from("profiles")
      .insert({ user_id: userId, display_name: displayName, avatar_url: avatarUrl })
      .select("id, user_id, display_name, avatar_url")
      .maybeSingle();
    if (error) return null;
    return created as ProfileRow;
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadRow[]> => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as ThreadRow[];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ title: z.string().max(2000).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<ThreadRow> => {
    const title = data.title ? cleanTitle(data.title) || "New chat" : "New chat";
    const { data: thread, error } = await context.supabase
      .from("chat_threads")
      .insert({ user_id: context.userId, title })
      .select("id, title, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return thread as ThreadRow;
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ threadId: uuid }).parse(input))
  .handler(
    async ({ data, context }): Promise<{ thread: ThreadRow | null; messages: MessageRow[] }> => {
      const { data: thread } = await context.supabase
        .from("chat_threads")
        .select("id, title, created_at, updated_at")
        .eq("id", data.threadId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!thread) return { thread: null, messages: [] };

      const { data: messages, error } = await context.supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("thread_id", data.threadId)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw new Error(error.message);
      return { thread: thread as ThreadRow, messages: (messages ?? []) as MessageRow[] };
    },
  );

/** Persist a completed user+assistant exchange and bump the thread. */
export const saveExchange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        threadId: uuid,
        userContent: z.string().min(1).max(MAX_USER_MESSAGE),
        assistantContent: z.string().min(1).max(MAX_ASSISTANT_MESSAGE),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: thread } = await supabase
      .from("chat_threads")
      .select("id, title")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");

    // Explicit timestamps keep the pair ordered (a batch insert shares now()).
    const now = Date.now();
    const { error: insErr } = await supabase.from("chat_messages").insert([
      {
        thread_id: data.threadId,
        user_id: userId,
        role: "user",
        content: data.userContent,
        created_at: new Date(now).toISOString(),
      },
      {
        thread_id: data.threadId,
        user_id: userId,
        role: "assistant",
        content: data.assistantContent,
        created_at: new Date(now + 1).toISOString(),
      },
    ]);
    if (insErr) throw new Error(insErr.message);

    const patch: { updated_at: string; title?: string } = {
      updated_at: new Date().toISOString(),
    };
    if (!thread.title || thread.title === "New chat") {
      patch.title = cleanTitle(data.userContent) || "New chat";
    }
    await supabase.from("chat_threads").update(patch).eq("id", data.threadId).eq("user_id", userId);

    return { ok: true, title: patch.title ?? thread.title };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ threadId: uuid, title: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chat_threads")
      .update({ title: data.title, updated_at: new Date().toISOString() })
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ threadId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chat_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Import a guest (browser-only) chat into the signed-in account. */
export const importThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        title: z.string().max(200),
        createdAt: z.number().int().nonnegative().optional(),
        updatedAt: z.number().int().nonnegative().optional(),
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(MAX_ASSISTANT_MESSAGE),
              at: z.number().int().nonnegative().optional(),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ThreadRow> => {
    const { supabase, userId } = context;
    const now = Date.now();
    // Never trust client clocks beyond "now".
    const clamp = (t: number | undefined, fallback: number) =>
      t && t > 0 && t <= now ? t : fallback;
    const updatedAt = clamp(data.updatedAt, now);
    const createdAt = Math.min(clamp(data.createdAt, updatedAt), updatedAt);

    const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({
        user_id: userId,
        title: cleanTitle(data.title) || "Imported chat",
        created_at: new Date(createdAt).toISOString(),
        updated_at: new Date(updatedAt).toISOString(),
      })
      .select("id, title, created_at, updated_at")
      .single();
    if (error || !thread) throw new Error(error?.message ?? "Could not import chat");

    // Strictly increasing timestamps preserve message order.
    let prev = createdAt - 1;
    const rows = data.messages.map((m) => {
      prev = Math.max(prev + 1, clamp(m.at, prev + 1));
      return {
        thread_id: thread.id,
        user_id: userId,
        role: m.role,
        content: m.content,
        created_at: new Date(prev).toISOString(),
      };
    });
    const { error: msgErr } = await supabase.from("chat_messages").insert(rows);
    if (msgErr) {
      await supabase.from("chat_threads").delete().eq("id", thread.id).eq("user_id", userId);
      throw new Error(msgErr.message);
    }
    return thread as ThreadRow;
  });
