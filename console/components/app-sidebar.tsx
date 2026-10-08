"use client"

import Link from "next/link"
import Image from "next/image"
import {
  LayoutDashboard,
  FolderKanban,
  Server,
  Activity,
  ScrollText,
  Settings,
  BookOpen,
  ExternalLink,
} from "lucide-react"

import { NavMain, type NavGroup } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navGroups: NavGroup[] = [
  {
    label: "Platform",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
      },
      {
        title: "Projects",
        url: "/projects",
        icon: FolderKanban,
      },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      {
        title: "Nodes",
        url: "/nodes",
        icon: Server,
      },
      {
        title: "Monitoring",
        url: "/monitoring",
        icon: Activity,
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        title: "Audit Logs",
        url: "/audit-logs",
        icon: ScrollText,
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings,
      },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header: Brand Identity */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! hover:bg-sidebar-accent/50 transition-colors"
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg overflow-hidden">
                <Image
                  src="/images/tako.png"
                  alt="Tako"
                  width={32}
                  height={32}
                  className="size-8 object-contain"
                  priority
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold tracking-tight text-sidebar-foreground">
                  Tako Cloud
                </span>
                <span className="truncate text-xs text-muted-foreground font-mono">
                  Self-Hosted PaaS
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Content: Grouped Navigation without Collapsible */}
      <SidebarContent className="px-2 py-2 group-data-[collapsible=icon]:px-0">
        <NavMain groups={navGroups} />
      </SidebarContent>

      {/* Footer: Cluster Health Status + Link to docs.gettako.dev */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2 group-data-[collapsible=icon]:p-2">
        <SidebarMenu>
          {/* Cluster Status Indicator */}
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              size="sm"
              tooltip="Cluster healthy (v0.4.2)"
              className="text-xs text-muted-foreground hover:text-foreground cursor-default hover:bg-transparent group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
            >
              <div className="flex size-4 shrink-0 items-center justify-center">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex flex-1 items-center justify-between group-data-[collapsible=icon]:hidden">
                <span className="truncate">Cluster healthy</span>
                <span className="font-mono text-[10px] text-muted-foreground/80">v0.4.2</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Documentation Link pointing to docs.gettako.dev */}
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              size="sm"
              tooltip="Documentation (docs.gettako.dev)"
              render={
                <a
                  href="https://docs.gettako.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              className="text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
            >
              <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate group-data-[collapsible=icon]:hidden">Docs & Guides</span>
              <ExternalLink className="size-3 ml-auto opacity-70 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Rail for dragging/clicking to toggle sidebar */}
      <SidebarRail />
    </Sidebar>
  )
}
