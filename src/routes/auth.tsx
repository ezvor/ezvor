import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Cloud,
  Github,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  MessagesSquare,
  Rocket,
  ShieldCheck,
  Trophy,
  User as UserIcon,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "magic" | "forgot" | "reset";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; mode?: Mode } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    mode:
      s.mode === "signup" || s.mode === "magic" || s.mode === "forgot" || s.mode === "reset"
        ? s.mode
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Ezvor" },
      {
        name: "description",
        content:
          "Sign in to Ezvor to sync your coding progress across devices, publish a public proof profile, keep your AI advisor history and join the leaderboard.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const perks = [
  { icon: Cloud, text: "Solved problems, notes and reviews synced across devices" },
  { icon: ShieldCheck, text: "A public proof profile backed by judge-verified solves" },
  { icon: MessagesSquare, text: "Your AI advisor conversations saved to your account" },
  { icon: Trophy, text: "A spot on the leaderboard when you go public" },
];

/** Only allow same-site paths as post-login destinations (no open redirects). */
function safeRedirect(raw: string | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw.startsWith("/auth") ? fallback : raw;
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/email not confirmed/i.test(msg))
    return "Please confirm your email first — check your inbox for the link.";
  if (/user already registered/i.test(msg))
    return "An account with this email already exists. Try signing in instead.";
  if (/provider is not enabled|unsupported provider/i.test(msg))
    return "This sign-in method isn't enabled on this deployment yet.";
  if (/rate limit|only request this after|too many/i.test(msg))
    return "Too many attempts. Please wait a minute and try again.";
  if (/password should be at least|weak password/i.test(msg))
    return "Choose a stronger password (at least 8 characters).";
  if (/signups not allowed/i.test(msg)) return "New sign-ups are disabled on this deployment.";
  if (/failed to fetch|network/i.test(msg))
    return "Couldn't reach the sign-in service. Check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}

/**
 * Which social providers are switched on in Supabase (Auth → Providers), read
 * from the public settings endpoint so disabled buttons never render.
 */
function useEnabledProviders(): { google: boolean; github: boolean } {
  const [enabled, setEnabled] = useState({ google: false, github: false });
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!url || !key) return;
    let cancelled = false;
    fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { external?: Record<string, boolean> } | null) => {
        if (!cancelled && s?.external) {
          setEnabled({ google: !!s.external.google, github: !!s.external.github });
        }
      })
      .catch(() => {
        /* keep social sign-in hidden; email still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}

function AuthPage() {
  if (!isSupabaseConfigured) return <AccountsDisabled />;
  return <AuthForms />;
}

function AccountsDisabled() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border/60 bg-gradient-card p-8 text-center"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary-glow">
          <HardDrive className="h-6 w-6" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">Accounts aren't enabled here</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This deployment of Ezvor runs without accounts. Everything still works — your solved
          problems, notes, review queue, settings and AI chats are saved in this browser
          automatically.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Moving to another device? Export your data from{" "}
          <Link to="/settings" className="text-primary-glow hover:underline">
            Settings
          </Link>{" "}
          and import it there.
        </p>
        <Button asChild className="mt-6 gap-2 bg-gradient-primary shadow-glow">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Back to Ezvor
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}

function AuthForms() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading, recovery, clearRecovery } = useAuth();
  const target = safeRedirect(search.redirect);

  const [mode, setModeState] = useState<Mode>(search.mode ?? "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<null | "email" | "google" | "github">(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<{
    email: string;
    kind: "confirm" | "magic" | "reset";
  } | null>(null);

  const providers = useEnabledProviders();
  const resetting = mode === "reset" || recovery;

  const setMode = (m: Mode) => {
    setModeState(m);
    setError(null);
    setSentTo(null);
  };

  useEffect(() => {
    if (recovery) setModeState("reset");
  }, [recovery]);

  // Already signed in (and not setting a new password)? Continue to the target.
  useEffect(() => {
    if (!authLoading && user && !resetting) navigate({ to: target, replace: true });
  }, [authLoading, user, resetting, target, navigate]);

  const callbackUrl = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ redirect: target, ...extra });
    return `${window.location.origin}/auth/callback?${params.toString()}`;
  };

  const run = async (kind: "email" | "google" | "github", fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleOAuth = (provider: "google" | "github") =>
    run(provider, async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl() },
      });
      if (error) throw error;
      // The browser is now redirecting to the provider; keep the spinner.
      await new Promise((r) => setTimeout(r, 4000));
    });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const addr = email.trim();

    if (mode === "reset" || resetting) {
      if (password.length < 8) return setError("Use at least 8 characters.");
      if (password !== confirm) return setError("The passwords don't match.");
      return void run("email", async () => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        clearRecovery();
        toast.success("Password updated. You're signed in.");
        navigate({ to: target, replace: true });
      });
    }

    if (!addr) return setError("Enter your email address.");

    if (mode === "magic") {
      return void run("email", async () => {
        const { error } = await supabase.auth.signInWithOtp({
          email: addr,
          options: { emailRedirectTo: callbackUrl() },
        });
        if (error) throw error;
        setSentTo({ email: addr, kind: "magic" });
      });
    }

    if (mode === "forgot") {
      return void run("email", async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(addr, {
          redirectTo: callbackUrl({ type: "recovery" }),
        });
        if (error) throw error;
        setSentTo({ email: addr, kind: "reset" });
      });
    }

    if (!password) return setError("Enter your password.");

    if (mode === "signup") {
      if (password.length < 8) return setError("Use at least 8 characters for your password.");
      return void run("email", async () => {
        const { data, error } = await supabase.auth.signUp({
          email: addr,
          password,
          options: {
            emailRedirectTo: callbackUrl(),
            data: { display_name: name.trim() || addr.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome to Ezvor!");
          navigate({ to: target, replace: true });
        } else {
          setSentTo({ email: addr, kind: "confirm" });
        }
      });
    }

    return void run("email", async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
      if (error) throw error;
      toast.success("Welcome back!");
      navigate({ to: target, replace: true });
    });
  };

  const heading: Record<Mode, [string, string]> = {
    signin: ["Welcome back", "Sign in to sync your progress and chats."],
    signup: ["Create your account", "Free forever. Your local progress comes with you."],
    magic: ["Email me a sign-in link", "No password needed — we'll send a one-time link."],
    forgot: ["Reset your password", "We'll email you a link to choose a new one."],
    reset: ["Choose a new password", "Pick something you haven't used elsewhere."],
  };
  const [title, subtitle] = heading[resetting ? "reset" : mode];
  const anyBusy = busy !== null;

  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-hero lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, oklch(0.6 0.2 280 / 25%), transparent 45%), radial-gradient(circle at 80% 60%, oklch(0.68 0.18 300 / 20%), transparent 40%)",
          }}
        />
        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Rocket className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="font-display text-lg font-bold">Ezvor</span>
        </Link>

        <div className="relative">
          <h1 className="max-w-md font-display text-4xl font-bold leading-tight">
            Your practice, everywhere you code.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Ezvor works without an account. Sign in when you want your progress to follow you and to
            show verified proof of your skills.
          </p>
          <ul className="mt-8 space-y-3">
            {perks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-foreground/90">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary-glow">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          100% free · No credit card · Open source
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="font-display text-lg font-bold">Ezvor</span>
          </div>

          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

          {sentTo ? (
            <SentNotice sentTo={sentTo} onBack={() => setMode("signin")} />
          ) : (
            <>
              {!resetting &&
                (mode === "signin" || mode === "signup") &&
                (providers.google || providers.github) && (
                  <>
                    <div className="mt-6 grid gap-2.5">
                      {providers.google && (
                        <OAuthButton
                          onClick={() => handleOAuth("google")}
                          loading={busy === "google"}
                          disabled={anyBusy}
                          icon={<GoogleIcon className="h-4 w-4" />}
                          label="Continue with Google"
                        />
                      )}
                      {providers.github && (
                        <OAuthButton
                          onClick={() => handleOAuth("github")}
                          loading={busy === "github"}
                          disabled={anyBusy}
                          icon={<Github className="h-4 w-4" />}
                          label="Continue with GitHub"
                        />
                      )}
                    </div>
                    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      or with email
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}

              <form
                onSubmit={handleSubmit}
                className={cn(
                  "space-y-4",
                  (resetting || mode === "magic" || mode === "forgot") && "mt-6",
                )}
                noValidate
              >
                {mode === "signup" && !resetting && (
                  <Field id="name" label="Name" icon={UserIcon}>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada Lovelace"
                      autoComplete="name"
                      maxLength={80}
                      className="pl-9"
                    />
                  </Field>
                )}

                {!resetting && (
                  <Field id="email" label="Email" icon={Mail}>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="pl-9"
                    />
                  </Field>
                )}

                {(resetting || mode === "signin" || mode === "signup") && (
                  <Field
                    id="password"
                    label={resetting ? "New password" : "Password"}
                    icon={Lock}
                    aside={
                      mode === "signin" && !resetting ? (
                        <button
                          type="button"
                          onClick={() => setMode("forgot")}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Forgot password?
                        </button>
                      ) : null
                    }
                  >
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={
                        mode === "signin" && !resetting ? "current-password" : "new-password"
                      }
                      className="pl-9"
                    />
                  </Field>
                )}

                {resetting && (
                  <Field id="confirm" label="Confirm new password" icon={KeyRound}>
                    <Input
                      id="confirm"
                      type="password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="pl-9"
                    />
                  </Field>
                )}

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {error}
                  </p>
                )}

                {resetting && !user && !authLoading && (
                  <p className="text-xs text-muted-foreground">
                    This reset link has expired or was already used.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        clearRecovery();
                        setMode("forgot");
                      }}
                      className="text-primary-glow hover:underline"
                    >
                      Send a new one
                    </button>
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={anyBusy || (resetting && !user)}
                  className="w-full gap-2 bg-gradient-primary shadow-glow"
                >
                  {busy === "email" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {resetting
                        ? "Update password"
                        : mode === "signin"
                          ? "Sign in"
                          : mode === "signup"
                            ? "Create account"
                            : mode === "magic"
                              ? "Send sign-in link"
                              : "Send reset link"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {!resetting && (
                <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
                  {mode === "signin" && (
                    <>
                      <p>
                        New to Ezvor?{" "}
                        <ModeLink onClick={() => setMode("signup")}>Create an account</ModeLink>
                      </p>
                      <p>
                        <ModeLink onClick={() => setMode("magic")}>
                          <Wand2 className="mr-1 inline h-3.5 w-3.5" />
                          Email me a sign-in link instead
                        </ModeLink>
                      </p>
                    </>
                  )}
                  {mode === "signup" && (
                    <p>
                      Already have an account?{" "}
                      <ModeLink onClick={() => setMode("signin")}>Sign in</ModeLink>
                    </p>
                  )}
                  {(mode === "magic" || mode === "forgot") && (
                    <p>
                      <ModeLink onClick={() => setMode("signin")}>
                        <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />
                        Back to sign in
                      </ModeLink>
                    </p>
                  )}
                </div>
              )}

              <p className="mt-8 text-center text-xs text-muted-foreground">
                No account needed to practice —{" "}
                <Link to="/" className="hover:text-foreground hover:underline">
                  continue as a guest
                </Link>
                . Your progress is saved in this browser and merges into your account when you sign
                in.
              </p>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                By continuing you agree to our{" "}
                <Link to="/terms" className="underline hover:text-foreground">
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>
                .
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function SentNotice({
  sentTo,
  onBack,
}: {
  sentTo: { email: string; kind: "confirm" | "magic" | "reset" };
  onBack: () => void;
}) {
  const copy = {
    confirm: "Open the confirmation link we sent to finish creating your account.",
    magic: "Open the link we sent to sign in. It works once and expires soon.",
    reset: "If an account exists for that address, you'll get a link to choose a new password.",
  }[sentTo.kind];
  return (
    <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-5">
      <p className="flex items-center gap-2 font-medium text-success">
        <MailCheck className="h-5 w-5" /> Check your inbox
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        We emailed <span className="font-medium text-foreground">{sentTo.email}</span>. {copy}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Nothing there? Check spam, or wait a minute and try again.
      </p>
      <Button type="button" variant="secondary" size="sm" className="mt-4 gap-1.5" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </Button>
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  aside,
  children,
}: {
  id: string;
  label: string;
  icon: typeof Mail;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}

function ModeLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-medium text-primary-glow hover:underline"
    >
      {children}
    </button>
  );
}

function OAuthButton({
  onClick,
  loading,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="w-full gap-2.5 border-border/70"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
