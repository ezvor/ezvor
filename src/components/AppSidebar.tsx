import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CheckCircle2,
  Compass,
  Flame,
  Gauge,
  GitBranch,
  Home,
  ListChecks,
  LogIn,
  LogOut,
  Map,
  Rocket,
  Settings,
  Sparkles,
  TerminalSquare,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { streakStats, useCollection } from "@/lib/local/store";
import { cn } from "@/lib/utils";

type NavItem = { title: string; url: string; icon: LucideIcon; match?: (path: string) => boolean };

const PRACTICE: NavItem[] = [
  { title: "Home", url: "/", icon: Home },
  {
    title: "Problems",
    url: "/problems",
    icon: ListChecks,
    match: (p) => p === "/problems" || p.startsWith("/problems/") || p.startsWith("/playground"),
  },
  { title: "Study Lists", url: "/lists", icon: GitBranch },
  { title: "Progress", url: "/progress", icon: TrendingUp },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Compiler", url: "/compiler", icon: TerminalSquare },
];

const CAREER: NavItem[] = [
  { title: "Readiness", url: "/readiness", icon: Gauge },
  { title: "Roadmaps", url: "/roadmaps", icon: Map },
  { title: "Opportunities", url: "/opportunities", icon: Compass },
  { title: "Resources", url: "/resources", icon: BookOpen },
  { title: "AI Advisor", url: "/advisor", icon: Sparkles },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { user, enabled, signOut } = useAuth();
  const solved = useCollection("solved");
  const activity = useCollection("activity");
  const streak = streakStats(activity);
  const solvedCount = Object.keys(solved).length;

  const isActive = (item: NavItem) =>
    item.match
      ? item.match(currentPath)
      : item.url === "/"
        ? currentPath === "/"
        : currentPath === item.url || currentPath.startsWith(`${item.url}/`);

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const meta = user?.user_metadata ?? {};
  const displayName: string =
    meta.display_name || meta.full_name || meta.name || user?.email?.split("@")[0] || "";
  const avatarUrl: string | undefined = meta.avatar_url || meta.picture;
  const initials =
    displayName
      .split(" ")
      .map((s: string) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const renderGroup = (label: string, items: NavItem[]) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.title}>
                <Link to={item.url} onClick={closeOnMobile} className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader>
        <Link
          to="/"
          onClick={closeOnMobile}
          className={
            collapsed
              ? "flex h-8 w-8 items-center justify-center"
              : "flex items-center gap-2.5 px-2 py-2"
          }
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Rocket className="h-4 w-4 text-primary-foreground" />
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate font-display text-lg font-bold text-sidebar-foreground">
                Ezvor
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                Interview prep &amp; careers
              </span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Practice", PRACTICE)}
        {renderGroup("Career", CAREER)}
      </SidebarContent>

      <SidebarFooter>
        {/* Local progress summary */}
        <Link
          to="/progress"
          onClick={closeOnMobile}
          title={`${streak.current}-day streak · ${solvedCount} solved`}
          aria-label={`${streak.current} day streak, ${solvedCount} problems solved. View progress`}
          className={cn(
            "flex items-center rounded-lg text-xs text-muted-foreground transition-colors hover:text-sidebar-foreground",
            collapsed
              ? "flex-col gap-1 py-1"
              : "justify-between gap-3 border border-sidebar-border/60 px-3 py-2",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Flame className={cn("h-3.5 w-3.5", streak.today > 0 && "text-warning")} />
            <span className="tabular-nums text-sidebar-foreground">{streak.current}</span>
            {!collapsed && <span>day streak</span>}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="tabular-nums text-sidebar-foreground">{solvedCount}</span>
            {!collapsed && <span>solved</span>}
          </span>
        </Link>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={currentPath === "/settings"} tooltip="Settings">
              <Link to="/settings" onClick={closeOnMobile} className="flex items-center gap-2.5">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {user ? (
          <div className={cnFooter(collapsed)}>
            <Avatar className="h-8 w-8 shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-gradient-primary text-xs text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {displayName || "Signed in"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        ) : enabled ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Sign in">
                <Link to="/auth" onClick={closeOnMobile} className="flex items-center gap-2.5">
                  <LogIn className="h-4 w-4" />
                  <span>Sign in</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}

function cnFooter(collapsed: boolean) {
  return collapsed
    ? "flex items-center justify-center px-1 py-2"
    : "flex items-center gap-2.5 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 px-2.5 py-2";
}
