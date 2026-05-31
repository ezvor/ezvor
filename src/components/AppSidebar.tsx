import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Compass,
  Map,
  Workflow,
  BookOpen,
  Sparkles,
  Rocket,
  Code2,
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

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Opportunities", url: "/opportunities", icon: Compass },
  { title: "Roadmaps", url: "/roadmaps", icon: Map },
  { title: "Skill Graphs", url: "/graph", icon: Workflow },
  { title: "Code Playground", url: "/playground", icon: Code2 },
  { title: "Resources", url: "/resources", icon: BookOpen },
  { title: "AI Advisor", url: "/advisor", icon: Sparkles },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

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
                PathPilot
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
        {!collapsed && (
          <p className="px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Free & AI-powered. Always verify dates on official pages.
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
