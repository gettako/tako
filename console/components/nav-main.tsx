"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export function NavMain({
  groups,
}: {
  groups: NavGroup[]
}) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleNavigate = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/"
    return pathname.startsWith(url)
  }

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label} className="py-1">
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 group-data-[collapsible=icon]:hidden">
            {group.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isActive(item.url)
                const Icon = item.icon
                return (
                  <SidebarMenuItem
                    key={item.title}
                    className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                  >
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={active}
                      render={<Link href={item.url} onClick={handleNavigate} />}
                      className={cn("transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!",
                        active
                          ? "bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary dark:bg-primary/15 dark:text-primary-60 dark:hover:bg-primary/25"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon
                        className={cn("size-4 shrink-0",
                          active ? "text-primary dark:text-primary-60" : "text-muted-foreground"
                        )}
                      />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
