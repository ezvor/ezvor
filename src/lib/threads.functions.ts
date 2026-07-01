import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

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

/** Create the profile row if missing, backfilling name/avatar from the provider. */
export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { displayName?: string | null; avatarUrl?: string | null }) => ({
    displayName: d?.displayName ?? null,
    avatarUrl: d?.avatarUrl ?? null,
  }))
  .handler(async ({ data, context }): Promise<ProfileRow> => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const patch: { display_name?: string | null; avatar_url?: string | null } = {};
      if (!existing.display_name && data.displayName) patch.display_name = data.displayName;
      if (!existing.avatar_url && data.avatarUrl) patch.avatar_url = data.avatarUrl;
      if (Object.keys(patch).length) {
        const { data: updated } = await supabase
          .from("profiles")
          .update(patch)
          .eq("user_id", userId)
          .select("id, user_id, display_name, avatar_url")
          .single();
        return updated as ProfileRow;
      }
      return existing as ProfileRow;
    }

    const { data: created, error } = await supabase
      .from("profiles")
      .insert({ user_id: userId, display_name: data.displayName, avatar_url: data.avatarUrl })
      .select("id, user_id, display_name, avatar_url")
      .single();
    if (error) throw new Error(error.message);
    return created as ProfileRow;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { displayName?: string | null; avatarUrl?: string | null }) => ({
    displayName: d?.displayName ?? null,
    avatarUrl: d?.avatarUrl ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        display_name: data.displayName,
        avatar_url: data.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadRow[]> => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ThreadRow[];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title?: string }) => ({ title: d?.title?.slice(0, 80) || "New chat" }))
  .handler(async ({ data, context }): Promise<ThreadRow> => {
    const { data: thread, error } = await context.supabase
      .from("chat_threads")
      .insert({ user_id: context.userId, title: data.title })
      .select("id, title, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return thread as ThreadRow;
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => ({ threadId: uuid.parse(d.threadId) }))
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
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return { thread: thread as ThreadRow, messages: (messages ?? []) as MessageRow[] };
    },
  );

/** Persist a completed user+assistant exchange and bump the thread. */
export const saveExchange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; userContent: string; assistantContent: string }) => ({
    threadId: uuid.parse(d.threadId),
    userContent: z.string().min(1).max(12000).parse(d.userContent),
    assistantContent: z.string().min(1).max(40000).parse(d.assistantContent),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: thread } = await supabase
      .from("chat_threads")
      .select("id, title")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");

    const { error: insErr } = await supabase.from("chat_messages").insert([
      { thread_id: data.threadId, user_id: userId, role: "user", content: data.userContent },
      {
        thread_id: data.threadId,
        user_id: userId,
        role: "assistant",
        content: data.assistantContent,
      },
    ]);
    if (insErr) throw new Error(insErr.message);

    const patch: { updated_at: string; title?: string } = {
      updated_at: new Date().toISOString(),
    };
    if (!thread.title || thread.title === "New chat") {
      const clean = data.userContent.trim().replace(/\s+/g, " ");
      patch.title = clean.length > 60 ? clean.slice(0, 60) + "…" : clean;
    }
    await supabase.from("chat_threads").update(patch).eq("id", data.threadId).eq("user_id", userId);

    return { ok: true, title: (patch.title as string) ?? thread.title };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; title: string }) => ({
    threadId: uuid.parse(d.threadId),
    title: z.string().min(1).max(80).parse(d.title),
  }))
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
  .inputValidator((d: { threadId: string }) => ({ threadId: uuid.parse(d.threadId) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chat_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
