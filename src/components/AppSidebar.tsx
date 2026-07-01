import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Compass,
  Map,
  BookOpen,
  Sparkles,
  Rocket,
  Code2,
  ListChecks,
  TerminalSquare,
  Gauge,
  LogOut,
  LogIn,
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

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Opportunities", url: "/opportunities", icon: Compass },
  { title: "Roadmaps & Graphs", url: "/roadmaps", icon: Map },
  { title: "DSA Arena", url: "/playground", icon: Code2 },
  { title: "Code Compiler", url: "/compiler", icon: TerminalSquare },
  { title: "Problem Catalog", url: "/problems", icon: ListChecks },
  { title: "Resources", url: "/resources", icon: BookOpen },
  { title: "AI Advisor", url: "/advisor", icon: Sparkles },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

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

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2.5 px-2 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Rocket className="h-5 w-5 text-primary-foreground" />
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold text-sidebar-foreground">
                Ezvor
              </span>
              <span className="text-[11px] text-muted-foreground">AI Career Guidance</span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <div
            className={cnFooter(collapsed)}
          >
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
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Sign in">
                <Link to="/auth" className="flex items-center gap-2.5">
                  <LogIn className="h-4 w-4" />
                  <span>Sign in</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function cnFooter(collapsed: boolean) {
  return collapsed
    ? "flex items-center justify-center px-1 py-2"
    : "flex items-center gap-2.5 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 px-2.5 py-2";
}
