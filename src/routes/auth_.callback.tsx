import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

// OAuth, magic-link, email-confirmation and password-reset links all land
// here. The browser client runs PKCE with `detectSessionInUrl`, so it swaps
// `?code=` for a session while initializing; we wait for that, surface any
// provider error, then continue to the `redirect` path.

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Signing you in… — Ezvor" }, { name: "robots", content: "noindex" }],
  }),
  component: AuthCallback,
});

function safeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw.startsWith("/auth") ? "/" : raw;
}

function readParams() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const get = (k: string) => query.get(k) ?? hash.get(k);
  return {
    code: query.get("code"),
    error: get("error_description") ?? get("error"),
    errorCode: get("error_code"),
    redirect: safeRedirect(query.get("redirect")),
    recovery: query.get("type") === "recovery" || hash.get("type") === "recovery",
  };
}

function describe(error: string, code: string | null): string {
  if (code === "otp_expired" || /expired|invalid/i.test(error)) {
    return "This link has expired or was already used. Request a new one and try again.";
  }
  if (/access_denied|denied/i.test(error)) return "Sign-in was cancelled.";
  if (/code verifier|both auth code and code verifier/i.test(error)) {
    return "Open the link in the same browser you requested it from, or request a new one.";
  }
  return error.replace(/\+/g, " ");
}

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!isSupabaseConfigured) {
      navigate({ to: "/auth", replace: true });
      return;
    }

    const params = readParams();
    if (params.error) {
      setError(describe(params.error, params.errorCode));
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setError("Signing in is taking too long. Please try again.");
    }, 15_000);

    (async () => {
      // getSession() waits for the client's own URL detection / code exchange.
      let { data } = await supabase.auth.getSession();
      if (!data.session && params.code) {
        const res = await supabase.auth.exchangeCodeForSession(params.code);
        if (res.error) throw res.error;
        data = { session: res.data.session };
      }
      if (cancelled) return;
      clearTimeout(timeout);
      if (!data.session) {
        setError("We couldn't complete sign-in. The link may have expired — please try again.");
        return;
      }
      if (params.recovery) {
        navigate({
          to: "/auth",
          search: { mode: "reset", redirect: params.redirect },
          replace: true,
        });
      } else {
        navigate({ to: params.redirect, replace: true });
      }
    })().catch((e: unknown) => {
      if (cancelled) return;
      clearTimeout(timeout);
      setError(describe(e instanceof Error ? e.message : String(e), null));
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-5">
      {error ? (
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-gradient-card p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
          <h1 className="mt-4 font-display text-xl font-bold">Couldn't sign you in</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button asChild className="mt-6 gap-2" variant="secondary">
            <Link to="/auth">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Signing you in…
        </p>
      )}
    </div>
  );
}
