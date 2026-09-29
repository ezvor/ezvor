import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

/** The signed-in user's own profile row (subset used across the UI). */
export interface OwnProfile {
  displayName: string | null;
  avatarUrl: string | null;
  handle: string | null;
  isPublic: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** False when this deployment runs without Supabase (local-only mode). */
  enabled: boolean;
  /** The user's profile row, or null while loading / signed out / unavailable. */
  profile: OwnProfile | null;
  /** True after a password-reset link signed the user in (show "set new password"). */
  recovery: boolean;
  clearRecovery: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: isSupabaseConfigured,
  enabled: isSupabaseConfigured,
  profile: null,
  recovery: false,
  clearRecovery: () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
});

async function fetchOwnProfile(userId: string): Promise<OwnProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, handle, is_public")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      handle: data.handle,
      isPublic: data.is_public,
    };
  } catch {
    return null;
  }
}

/**
 * Single source of truth for auth state. This is the ONLY place that subscribes
 * to `onAuthStateChange`, so we never get competing listeners thrashing state.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [recovery, setRecovery] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const lastUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const next = await fetchOwnProfile(userId);
    // Ignore a stale response if the user changed while we were fetching.
    if (lastUserId.current === userId) setProfile(next);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        lastUserId.current = data.session?.user.id ?? null;
        void loadProfile(lastUserId.current);
      })
      .catch(() => {
        /* offline or storage blocked — stay signed out */
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession) => {
      const nextId = nextSession?.user.id ?? null;
      setSession(nextSession);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);

      // Only react to real identity transitions (sign in / sign out / switch).
      if (nextId !== lastUserId.current) {
        lastUserId.current = nextId;
        setProfile(null);
        queryClient.clear();
        // Defer: supabase-js forbids awaiting its own calls inside this callback.
        setTimeout(() => {
          void loadProfile(nextId);
          void router.invalidate();
        }, 0);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      enabled: isSupabaseConfigured,
      profile,
      recovery,
      clearRecovery: () => setRecovery(false),
      refreshProfile: () => loadProfile(lastUserId.current),
      signOut: async () => {
        if (!isSupabaseConfigured) return;
        try {
          await supabase.auth.signOut();
        } catch {
          // Network failure: still drop the local session so the UI signs out.
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        }
      },
    }),
    [session, loading, profile, recovery, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Display name + avatar for a user, preferring their saved profile. */
export function userIdentity(user: User | null, profile: OwnProfile | null) {
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const displayName =
    profile?.displayName ||
    meta.display_name ||
    meta.full_name ||
    meta.name ||
    user?.email?.split("@")[0] ||
    "You";
  const avatarUrl = profile?.avatarUrl || meta.avatar_url || meta.picture || undefined;
  const initials =
    displayName
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";
  return { displayName, avatarUrl, initials };
}
