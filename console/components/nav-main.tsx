"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { CaretRightIcon } from "@phosphor-icons/react"

export interface NavItem {
  title: string
  url: string
  icon?: React.ReactNode
  isActive?: boolean
  items?: {
    title: string
    url: string
  }[]
}

/**
 * @deprecated NavMain is deprecated as part of M17-001 in favor of horizontal AppHeader navigation tabs.
 */
export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isItemActive =
            item.isActive ??
            (pathname === item.url ||
              (item.url !== "/" && pathname?.startsWith(item.url)))

          if (!item.items || item.items.length === 0) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={isItemActive}
                  tooltip={item.title}
                  render={
                    <Link
                      href={item.url}
                      onClick={handleLinkClick}
                      data-active={isItemActive ? "true" : undefined}
                    />
                  }
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          return (
            <Collapsible
              key={item.title}
              defaultOpen={isItemActive}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    isActive={isItemActive}
                    tooltip={item.title}
                  />
                }
              >
                {item.icon}
                <span>{item.title}</span>
                <CaretRightIcon className="ml-auto size-4 transition-transform duration-200 group-data-open/collapsible:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items.map((subItem) => {
                    const isSubActive = pathname === subItem.url
                    return (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          isActive={isSubActive}
                          render={
                            <Link
                              href={subItem.url}
                              onClick={handleLinkClick}
                              data-active={isSubActive ? "true" : undefined}
                            />
                          }
                        >
                          <span>{subItem.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
