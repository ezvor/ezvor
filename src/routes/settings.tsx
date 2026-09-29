import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Cloud,
  Download,
  ExternalLink,
  Github,
  Globe,
  HardDrive,
  Linkedin,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  checkHandle,
  deleteMyData,
  getMyProfile,
  updateProfile,
  type MyProfile,
} from "@/lib/readiness.functions";
import {
  HANDLE_RE,
  LOCAL_READINESS_KEY,
  githubUrl,
  linkedinUrl,
  loadLocalReadiness,
  normalizeGithub,
  normalizeLinkedin,
  saveLocalReadiness,
} from "@/lib/readiness";
import {
  DEFAULT_EDITOR_SETTINGS,
  getCollection,
  setCollection,
  type CollectionName,
  type Collections,
  type SubmissionEntry,
} from "@/lib/local/store";
import { clearLocalChats, exportLocalChats, importLocalChats } from "@/lib/local/chats";
import {
  clearSyncState,
  getSyncStatus,
  onSyncStatus,
  syncNow,
  type SyncStatus,
} from "@/lib/local/sync";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Ezvor" },
      { name: "description", content: "Manage your Ezvor profile, account and local data." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, enabled, loading } = useAuth();
  const signedIn = enabled && !!user;

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow="Settings"
        title="Your profile & data"
        description={
          signedIn
            ? "Edit your public profile, manage your account and export your data."
            : "Everything you do on Ezvor is saved in this browser. Export it, move it or clear it here."
        }
      />
      <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8 sm:px-8">
        {enabled && loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : signedIn ? (
          <>
            <ProfileSection />
            <AccountSection />
          </>
        ) : enabled ? (
          <Section icon={LogIn} title="Account">
            <p className="text-sm text-muted-foreground">
              Sign in to sync your progress across devices, keep your AI chats and publish a public
              profile. Your local progress merges into your account automatically.
            </p>
            <Button asChild className="mt-4 gap-1.5 bg-gradient-primary shadow-glow" size="sm">
              <Link to="/auth" search={{ redirect: "/settings" }}>
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
            </Button>
          </Section>
        ) : null}
        <DataSection signedIn={signedIn} />
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
  tone,
}: {
  icon: typeof UserRound;
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "danger";
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-gradient-card p-5 sm:p-6",
        tone === "danger" ? "border-destructive/30" : "border-border/60",
      )}
    >
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Icon
          className={cn("h-5 w-5", tone === "danger" ? "text-destructive" : "text-primary-glow")}
        />
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- profile */

type HandleState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "bad"; reason: string };

function ProfileSection() {
  const { user, refreshProfile } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => getMyProfile(),
  });

  if (profileQuery.isLoading) {
    return (
      <Section icon={UserRound} title="Public profile">
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Section>
    );
  }
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <Section icon={UserRound} title="Public profile">
        <p className="text-sm text-muted-foreground">Couldn't load your profile.</p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          onClick={() => void profileQuery.refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </Section>
    );
  }
  return (
    <ProfileForm
      initial={profileQuery.data}
      onSaved={() => {
        void profileQuery.refetch();
        void refreshProfile();
      }}
    />
  );
}

function ProfileForm({ initial, onSaved }: { initial: MyProfile; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [handle, setHandle] = useState(initial.handle ?? "");
  const [headline, setHeadline] = useState(initial.headline ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [github, setGithub] = useState(initial.github ?? "");
  const [linkedin, setLinkedin] = useState(initial.linkedin ?? "");
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [saving, setSaving] = useState(false);
  const [handleState, setHandleState] = useState<HandleState>({ status: "idle" });
  const checkSeq = useRef(0);

  // Debounced availability check.
  useEffect(() => {
    const value = handle.trim();
    if (!value || value.toLowerCase() === (initial.handle ?? "").toLowerCase()) {
      setHandleState({ status: "idle" });
      return;
    }
    if (!HANDLE_RE.test(value)) {
      setHandleState({ status: "bad", reason: "Use 3–30 letters, numbers, - or _." });
      return;
    }
    setHandleState({ status: "checking" });
    const seq = ++checkSeq.current;
    const t = setTimeout(() => {
      checkHandle({ data: { handle: value } })
        .then((r) => {
          if (seq !== checkSeq.current) return;
          setHandleState(
            r.available ? { status: "ok" } : { status: "bad", reason: r.reason ?? "Taken." },
          );
        })
        .catch(() => seq === checkSeq.current && setHandleState({ status: "idle" }));
    }, 400);
    return () => clearTimeout(t);
  }, [handle, initial.handle]);

  const githubInvalid = !!github.trim() && !normalizeGithub(github);
  const linkedinInvalid = !!linkedin.trim() && !normalizeLinkedin(linkedin);
  const handleInvalid = handleState.status === "bad";
  const canSave =
    !saving &&
    !githubInvalid &&
    !linkedinInvalid &&
    !handleInvalid &&
    handleState.status !== "checking";

  const save = async (overrides: { isPublic?: boolean } = {}) => {
    const nextPublic = overrides.isPublic ?? isPublic;
    if (nextPublic && !handle.trim()) {
      toast.error("Pick a username before making your profile public.");
      return;
    }
    setSaving(true);
    try {
      const res = await updateProfile({
        data: {
          displayName: displayName.trim() || null,
          handle: handle.trim() || null,
          headline: headline.trim() || null,
          location: location.trim() || null,
          bio: bio.trim() || null,
          github: github.trim() || null,
          linkedin: linkedin.trim() || null,
          isPublic: nextPublic,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't save your profile");
        return;
      }
      setIsPublic(nextPublic);
      const gh = normalizeGithub(github);
      const li = normalizeLinkedin(linkedin);
      if (gh) setGithub(gh);
      if (li) setLinkedin(li);
      toast.success("Profile saved");
      onSaved();
    } catch {
      toast.error("Couldn't save your profile. Check your details and try again.");
    } finally {
      setSaving(false);
    }
  };

  const savedHandle = initial.handle;
  const profilePath = savedHandle ? `/p/${savedHandle}` : null;

  return (
    <Section
      icon={UserRound}
      title="Public profile"
      description="Shown on your shareable proof page and the leaderboard when your profile is public."
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) void save();
        }}
      >
        <FormField id="displayName" label="Display name">
          <Input
            id="displayName"
            value={displayName}
            maxLength={80}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ada Lovelace"
          />
        </FormField>

        <FormField
          id="handle"
          label="Username"
          hint={
            handleState.status === "checking" ? (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking…
              </span>
            ) : handleState.status === "ok" ? (
              <span className="flex items-center gap-1 text-success">
                <Check className="h-3 w-3" /> Available
              </span>
            ) : handleState.status === "bad" ? (
              <span className="flex items-center gap-1 text-destructive">
                <X className="h-3 w-3" /> {handleState.reason}
              </span>
            ) : (
              <span className="text-muted-foreground">Your profile lives at /p/username</span>
            )
          }
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">/p/</span>
            <Input
              id="handle"
              value={handle}
              maxLength={30}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              placeholder="yourname"
              aria-invalid={handleInvalid}
              autoComplete="username"
            />
          </div>
        </FormField>

        <FormField id="headline" label="Headline" className="sm:col-span-2">
          <Input
            id="headline"
            value={headline}
            maxLength={160}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="CS student · aspiring backend engineer"
          />
        </FormField>

        <FormField id="location" label="Location">
          <Input
            id="location"
            value={location}
            maxLength={80}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Lahore, Pakistan"
          />
        </FormField>

        <div className="hidden sm:block" />

        <FormField
          id="github"
          label="GitHub"
          hint={
            githubInvalid ? (
              <span className="text-destructive">Enter a GitHub username or profile URL.</span>
            ) : null
          }
        >
          <div className="relative">
            <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="github"
              value={github}
              maxLength={200}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="octocat"
              className="pl-9"
              aria-invalid={githubInvalid}
            />
          </div>
        </FormField>

        <FormField
          id="linkedin"
          label="LinkedIn"
          hint={
            linkedinInvalid ? (
              <span className="text-destructive">Enter your LinkedIn profile URL or slug.</span>
            ) : null
          }
        >
          <div className="relative">
            <Linkedin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="linkedin"
              value={linkedin}
              maxLength={200}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="linkedin.com/in/your-name"
              className="pl-9"
              aria-invalid={linkedinInvalid}
            />
          </div>
        </FormField>

        <FormField
          id="bio"
          label="Bio"
          className="sm:col-span-2"
          hint={<span className="text-muted-foreground">{bio.length}/600</span>}
        >
          <Textarea
            id="bio"
            value={bio}
            maxLength={600}
            rows={4}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What you're learning, building, or looking for."
          />
        </FormField>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/40 px-4 py-3 sm:col-span-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Globe className="h-4 w-4 text-primary-glow" /> Public profile
            </p>
            <p className="text-xs text-muted-foreground">
              Anyone with the link can see your name, links and verified solves. Your code, notes
              and chats stay private.
            </p>
          </div>
          <Switch
            checked={isPublic}
            disabled={saving}
            aria-label="Make profile public"
            onCheckedChange={(v) => void save({ isPublic: v })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button
            type="submit"
            disabled={!canSave}
            className="gap-1.5 bg-gradient-primary shadow-glow"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save profile
          </Button>
          {isPublic && profilePath && (
            <Link
              to="/p/$handle"
              params={{ handle: savedHandle as string }}
              className="inline-flex items-center gap-1 text-sm text-primary-glow hover:underline"
            >
              View {profilePath} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          {(github && normalizeGithub(github)) || (linkedin && normalizeLinkedin(linkedin)) ? (
            <span className="flex gap-3 text-xs text-muted-foreground">
              {normalizeGithub(github) && (
                <a
                  href={githubUrl(normalizeGithub(github)!)}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground"
                >
                  Test GitHub link
                </a>
              )}
              {normalizeLinkedin(linkedin) && (
                <a
                  href={linkedinUrl(normalizeLinkedin(linkedin)!)}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground"
                >
                  Test LinkedIn link
                </a>
              )}
            </span>
          ) : null}
        </div>
      </form>
    </Section>
  );
}

function FormField({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <div className="text-[11px]">{hint}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- account */

function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  useEffect(() => onSyncStatus(setStatus), []);
  return status;
}

function AccountSection() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const sync = useSyncStatus();
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const profileQuery = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => getMyProfile(),
  });
  const canDeleteAccount = !!profileQuery.data?.canDeleteAccount;
  const providers = (
    (user?.app_metadata?.providers as string[] | undefined) ?? [
      user?.app_metadata?.provider as string | undefined,
    ]
  ).filter(Boolean);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      await syncNow();
      toast.success(
        getSyncStatus() === "error" ? "Sync finished with errors" : "Everything is synced",
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (deleteAccount: boolean) => {
    setDeleting(true);
    try {
      const res = await deleteMyData({ data: { deleteAccount } });
      if (res.accountDeleted) {
        toast.success("Your account and its data were deleted.");
      } else if (res.ok) {
        toast.success("Your cloud data was deleted. Data on this device was kept.");
      } else {
        toast.error(`Some data couldn't be deleted: ${res.failed.join(", ")}.`);
      }
      // Stop syncing so this device doesn't re-upload what was just removed.
      clearSyncState();
      await signOut();
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete your data. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Section icon={Cloud} title="Account">
        <dl className="grid gap-3 text-sm sm:grid-cols-[140px_1fr]">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="truncate font-medium">{user?.email ?? "—"}</dd>
          <dt className="text-muted-foreground">Signed in with</dt>
          <dd className="capitalize">{providers.length ? providers.join(", ") : "email"}</dd>
          <dt className="text-muted-foreground">Cloud sync</dt>
          <dd className="flex items-center gap-2">
            {sync === "syncing" || syncing ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing…
              </span>
            ) : sync === "error" ? (
              <span className="flex items-center gap-1.5 text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> Paused — changes are saved on this device
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-success">
                <Check className="h-3.5 w-3.5" /> Notes, bookmarks, reviews and settings synced
              </span>
            )}
          </dd>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void runSync()} disabled={syncing}>
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} /> Sync now
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void handleSignOut()}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </Section>

      <Section
        icon={Trash2}
        title="Delete my data"
        tone="danger"
        description="Permanently remove what Ezvor stores in the cloud for you. Data saved in this browser is not affected — clear it below."
      >
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Synced notes, bookmarks, review queue and settings</li>
          <li>AI advisor chats</li>
          <li>
            Solved problems{canDeleteAccount ? ", submissions" : ""}, career target and roadmap
            progress
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <ConfirmButton
            label="Delete cloud data"
            title="Delete your cloud data?"
            description="This permanently deletes your synced data, chats and solve history from your account, makes your profile private and signs you out. This can't be undone."
            confirmLabel="Delete data"
            busy={deleting}
            onConfirm={() => void handleDelete(false)}
          />
          {canDeleteAccount && (
            <ConfirmButton
              label="Delete account"
              title="Delete your account?"
              description="This permanently deletes your account, profile and everything associated with it. This can't be undone."
              confirmLabel="Delete account"
              busy={deleting}
              onConfirm={() => void handleDelete(true)}
            />
          )}
        </div>
      </Section>
    </>
  );
}

function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  variant = "destructive",
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  variant?: "destructive" | "secondary";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={variant} disabled={busy} className="gap-1.5">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------- data */

const ALL_COLLECTIONS: CollectionName[] = [
  "solved",
  "submissions",
  "notes",
  "bookmarks",
  "review",
  "activity",
  "settings",
];
const EMPTY: { [K in CollectionName]: () => Collections[K] } = {
  solved: () => ({}),
  submissions: () => [],
  notes: () => ({}),
  bookmarks: () => ({}),
  review: () => ({}),
  activity: () => ({}),
  settings: () => ({ ...DEFAULT_EDITOR_SETTINGS }),
};
const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

type ExportFile = {
  app: "ezvor";
  version: 2;
  exportedAt: string;
  collections: Partial<Collections>;
  chats?: unknown;
  readiness?: unknown;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function importCollections(file: ExportFile): number {
  const c = file.collections ?? {};
  let touched = 0;
  const recordOf = <T,>(v: unknown, ok: (e: Record<string, unknown>) => boolean) =>
    isRecord(v)
      ? (Object.fromEntries(
          Object.entries(v).filter(([k, e]) => k.length <= 200 && isRecord(e) && ok(e)),
        ) as Record<string, T>)
      : null;

  const solved = recordOf<Collections["solved"][string]>(
    c.solved,
    (e) => typeof e.slug === "string" && typeof e.title === "string",
  );
  if (solved) {
    setCollection("solved", (prev) => {
      const next = { ...prev };
      for (const [k, e] of Object.entries(solved)) {
        // Imported files can't vouch for server verification.
        next[k] = {
          ...e,
          verified: prev[k]?.verified ?? false,
          solvedAt: Number(e.solvedAt) || Date.now(),
        };
      }
      return next;
    });
    touched++;
  }

  if (Array.isArray(c.submissions)) {
    const incoming = (c.submissions as unknown[]).filter(
      (s): s is SubmissionEntry =>
        isRecord(s) && typeof s.id === "string" && typeof s.slug === "string",
    );
    setCollection("submissions", (prev) => {
      const seen = new Set(prev.map((s) => s.id));
      return [
        ...prev,
        ...incoming.filter((s) => !seen.has(s.id)).map((s) => ({ ...s, verified: false })),
      ]
        .sort((a, b) => b.at - a.at)
        .slice(0, 400);
    });
    touched++;
  }

  const notes = recordOf<Collections["notes"][string]>(c.notes, (e) => typeof e.text === "string");
  if (notes) {
    setCollection("notes", (prev) => {
      const next = { ...prev };
      for (const [k, e] of Object.entries(notes)) {
        if (!next[k] || (Number(e.updatedAt) || 0) > next[k].updatedAt) {
          next[k] = {
            slug: k,
            text: e.text.slice(0, 20_000),
            updatedAt: Number(e.updatedAt) || Date.now(),
          };
        }
      }
      return next;
    });
    touched++;
  }

  const bookmarks = recordOf<Collections["bookmarks"][string]>(c.bookmarks, () => true);
  if (bookmarks) {
    setCollection("bookmarks", (prev) => {
      const next = { ...prev };
      for (const [k, e] of Object.entries(bookmarks))
        next[k] ??= { slug: k, at: Number(e.at) || Date.now() };
      return next;
    });
    touched++;
  }

  const review = recordOf<Collections["review"][string]>(
    c.review,
    (e) => typeof e.due === "number" && typeof e.title === "string",
  );
  if (review) {
    setCollection("review", (prev) => ({ ...review, ...prev }));
    touched++;
  }

  if (isRecord(c.activity)) {
    setCollection("activity", (prev) => {
      const next = { ...prev };
      for (const [k, n] of Object.entries(c.activity as Record<string, unknown>)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof n === "number" && n > 0) {
          next[k] = Math.max(next[k] ?? 0, Math.min(10_000, Math.floor(n)));
        }
      }
      return next;
    });
    touched++;
  }

  if (isRecord(c.settings)) {
    setCollection("settings", {
      ...DEFAULT_EDITOR_SETTINGS,
      ...getCollection("settings"),
      ...(c.settings as object),
    });
    touched++;
  }

  if (file.chats) touched += importLocalChats(file.chats) > 0 ? 1 : 0;
  if (isRecord(file.readiness) && !loadLocalReadiness()) {
    try {
      window.localStorage.setItem(LOCAL_READINESS_KEY, JSON.stringify(file.readiness));
    } catch {
      /* ignore */
    }
  }
  return touched;
}

function DataSection({ signedIn }: { signedIn: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const counts = {
    solved: Object.keys(getCollection("solved")).length,
    notes: Object.keys(getCollection("notes")).length,
    submissions: getCollection("submissions").length,
    chats: exportLocalChats().length,
  };

  const handleExport = () => {
    const data: ExportFile = {
      app: "ezvor",
      version: 2,
      exportedAt: new Date().toISOString(),
      collections: Object.fromEntries(ALL_COLLECTIONS.map((n) => [n, getCollection(n)])),
      chats: exportLocalChats(),
      readiness: loadLocalReadiness(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ezvor-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error("That file is too large to be an Ezvor export.");
      return;
    }
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text()) as Partial<ExportFile>;
      if (parsed?.app !== "ezvor" || !isRecord(parsed.collections)) {
        toast.error("That doesn't look like an Ezvor export file.");
        return;
      }
      const n = importCollections(parsed as ExportFile);
      toast.success(n ? "Import complete — your data was merged." : "Nothing new to import.");
    } catch {
      toast.error("Couldn't read that file. Is it a valid Ezvor export?");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleClear = () => {
    // Silent writes: clearing this device must not delete the synced cloud copy.
    for (const name of ALL_COLLECTIONS) {
      setCollection(name, EMPTY[name]() as never, { silent: true });
    }
    clearLocalChats();
    saveLocalReadiness(null);
    clearSyncState();
    toast.success(
      signedIn
        ? "Cleared this device. Your synced data will download again from your account."
        : "Local data cleared.",
    );
    if (signedIn) void syncNow();
  };

  return (
    <Section
      icon={HardDrive}
      title="Data on this device"
      description="Solved problems, submissions, notes, bookmarks, reviews, settings and advisor chats saved in this browser."
    >
      <p className="text-xs text-muted-foreground">
        {counts.solved} solved · {counts.submissions} submissions · {counts.notes} notes ·{" "}
        {counts.chats} device chat{counts.chats === 1 ? "" : "s"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={handleExport} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export JSON
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="gap-1.5"
        >
          {importing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Import JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void handleImport(e.target.files?.[0])}
        />
        <ConfirmButton
          label="Clear local data"
          title="Clear data on this device?"
          description={
            signedIn
              ? "This removes Ezvor data from this browser only. Anything synced to your account will download again; unsynced local-only data (like device chats and unverified solves) will be lost."
              : "This permanently removes your solved problems, submissions, notes, bookmarks, reviews, settings and chats from this browser. Export first if you want a backup."
          }
          confirmLabel="Clear data"
          onConfirm={handleClear}
        />
      </div>
    </Section>
  );
}
