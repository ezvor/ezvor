// Client-side persistent chat history for the AI advisor.
// Stored in localStorage so it works without sign-up and survives reloads.

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMsg[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "pathpilot.chat.history.v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadConversations(): Conversation[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function persist(conversations: Conversation[]) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // storage full or unavailable — fail silently
  }
}

function makeTitle(messages: ChatMsg[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const base = firstUser?.content.trim() ?? "New chat";
  return base.length > 48 ? base.slice(0, 48) + "…" : base;
}

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Insert or update a conversation, returning the full sorted list. */
export function saveConversation(conv: Conversation): Conversation[] {
  const all = loadConversations();
  const idx = all.findIndex((c) => c.id === conv.id);
  const updated: Conversation = {
    ...conv,
    title: conv.title || makeTitle(conv.messages),
    updatedAt: Date.now(),
  };
  if (idx === -1) all.push(updated);
  else all[idx] = updated;
  const sorted = all.sort((a, b) => b.updatedAt - a.updatedAt);
  persist(sorted);
  return sorted;
}

export function deleteConversation(id: string): Conversation[] {
  const all = loadConversations().filter((c) => c.id !== id);
  persist(all);
  return all;
}

export function clearAllConversations(): Conversation[] {
  persist([]);
  return [];
}
