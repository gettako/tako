"use client"

import * as React from "react"
import Link from "next/link"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
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
import {
  GaugeIcon,
  FolderSimpleIcon,
  HardDrivesIcon,
  GearSixIcon,
  BookOpenIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react"
import { getDiceBearAvatar } from "@/lib/utils"

const sidebarData = {
  user: {
    name: "Admin",
    email: "admin@tako.local",
    avatar: getDiceBearAvatar("admin@tako.local"),
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <GaugeIcon className="size-4" />,
    },
    {
      title: "Projects",
      url: "/projects",
      icon: <FolderSimpleIcon className="size-4" />,
    },
    {
      title: "Servers",
      url: "/servers",
      icon: <HardDrivesIcon className="size-4" />,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: <GearSixIcon className="size-4" />,
    },
  ],
}

/**
 * @deprecated AppSidebar is deprecated as part of M17-001 in favor of the horizontal AppHeader navigation.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <img
                  src="/icon.svg"
                  alt="Tako"
                  className="size-5 object-contain"
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight">
                  Tako Control Plane
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Self-Hosted
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarData.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Documentation"
              render={
                <a
                  href="https://github.com/gettako/tako"
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <BookOpenIcon className="size-4" />
              <span>Documentation</span>
              <ArrowSquareOutIcon className="ml-auto size-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
