import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Cloud, CloudOff, Loader2, LogIn, LogOut, Rocket, Settings, UserRound } from "lucide-react";

import appCss from "../styles.css?url";
import { SITE, absoluteUrl } from "@/config/site";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthProvider, useAuth, userIdentity } from "@/hooks/useAuth";
import { CloudSync, getSyncStatus, onSyncStatus, type SyncStatus } from "@/lib/local/sync";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: `${SITE.name} — ${SITE.tagline}` },
      { name: "description", content: SITE.description },
      { name: "author", content: SITE.name },
      { name: "theme-color", content: "#0b0b14" },
      { name: "color-scheme", content: "dark" },
      { property: "og:site_name", content: SITE.name },
      { property: "og:title", content: `${SITE.name} — ${SITE.tagline}` },
      { property: "og:description", content: SITE.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE.url },
      { property: "og:image", content: absoluteUrl(SITE.ogImage) },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${SITE.name} — ${SITE.tagline}` },
      { name: "twitter:description", content: SITE.description },
      { name: "twitter:image", content: absoluteUrl(SITE.ogImage) },
    ],
    links: [
      { rel: "canonical", href: SITE.url },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CloudSync />
        <SidebarProvider>
          <div className="flex min-h-screen w-full bg-background">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-lg">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <div className="h-5 w-px bg-border" />
                <Link to="/" className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
                    <Rocket className="h-4 w-4 text-primary-foreground" />
                  </span>
                  <span className="font-display text-sm font-semibold tracking-tight">Ezvor</span>
                </Link>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Interview prep &amp; careers
                </span>
                <div className="ml-auto">
                  <HeaderAuth />
                </div>
              </header>

              <main className="min-w-0 flex-1">
                <Outlet />
              </main>
            </div>
          </div>
          <Toaster richColors position="top-center" />
        </SidebarProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function HeaderAuth() {
  const { user, loading, enabled } = useAuth();

  // Accounts disabled on this deployment: no sign-in UI at all.
  if (!enabled || !isSupabaseConfigured) return null;
  if (loading) return <div className="h-8 w-8" aria-hidden />;

  if (!user) {
    return (
      <Button asChild size="sm" variant="secondary" className="gap-1.5">
        <Link to="/auth">
          <LogIn className="h-4 w-4" /> Sign in
        </Link>
      </Button>
    );
  }

  return <AccountMenu />;
}

function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  useEffect(() => onSyncStatus(setStatus), []);
  return status;
}

function AccountMenu() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const sync = useSyncStatus();
  const { displayName, avatarUrl, initials } = userIdentity(user, profile);

  const handleSignOut = async () => {
    await signOut();
    void router.navigate({ to: "/" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-border/60 bg-card/70 py-0.5 pl-0.5 pr-2.5 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          <Avatar className="h-7 w-7">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="bg-gradient-primary text-[11px] text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
            {displayName}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {sync === "syncing" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Syncing…
              </>
            ) : sync === "error" ? (
              <>
                <CloudOff className="h-3 w-3 text-warning" /> Sync paused — saved on this device
              </>
            ) : (
              <>
                <Cloud className="h-3 w-3 text-success" /> Progress synced
              </>
            )}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profile?.handle && profile.isPublic && (
          <DropdownMenuItem asChild>
            <Link to="/p/$handle" params={{ handle: profile.handle }}>
              <UserRound className="mr-2 h-4 w-4" /> Public profile
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleSignOut()} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
