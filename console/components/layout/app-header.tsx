"use client"

import * as React from "react"
import Link from "next/link"
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"

import { BreadcrumbDropdown } from "@/components/layout/breadcrumb-dropdown"
import { UserMenu } from "@/components/layout/user-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { openCommandPalette } from "@/hooks/use-command-palette"
import type { BreadcrumbItem } from "@/lib/breadcrumbs"

interface AppHeaderProps {
  breadcrumbs: BreadcrumbItem[]
  isCollapsed: boolean
  onOpenMobileNavigation: () => void
  onToggleSidebar: () => void
}

export function AppHeader({
  breadcrumbs,
  isCollapsed,
  onOpenMobileNavigation,
  onToggleSidebar,
}: AppHeaderProps) {
  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <div className="flex items-center gap-2.5">
        {/* Mobile drawer trigger */}
        <Button
          size="icon-sm"
          variant="outline"
          className="lg:hidden"
          onClick={onOpenMobileNavigation}
          aria-label="Open mobile navigation"
        >
          <Menu className="size-4" />
        </Button>

        {/* Desktop sidebar expand / collapse trigger */}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="hidden size-8 text-muted-foreground hover:text-foreground lg:flex"
          onClick={onToggleSidebar}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>

        <nav
          aria-label="Breadcrumbs"
          className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
        >
          <Link
            href="/dashboard"
            className="shrink-0 font-semibold tracking-wider text-foreground uppercase transition-colors hover:text-primary"
          >
            Tako
          </Link>
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.href}>
              <span className="shrink-0 text-muted-foreground/60">/</span>
              {crumb.dropdownItems && crumb.dropdownItems.length > 0 ? (
                <BreadcrumbDropdown
                  label={crumb.label}
                  href={crumb.href}
                  isCurrent={crumb.isCurrent}
                  items={crumb.dropdownItems}
                />
              ) : crumb.isCurrent ? (
                <span className="max-w-[180px] truncate font-medium text-foreground sm:max-w-[240px]">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="max-w-[130px] shrink-0 truncate transition-colors hover:text-foreground hover:underline"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openCommandPalette}
          title="Search console (⌘K)"
          aria-label="Search console"
          aria-keyshortcuts="Meta+K Control+K"
          className="h-11 min-w-11 gap-2 px-0 text-xs font-normal text-muted-foreground hover:text-foreground sm:h-8 sm:min-w-0 sm:px-2.5"
        >
          <Search className="size-3.5" />
          <span className="hidden md:inline">Search console...</span>
          <kbd className="pointer-events-none hidden h-5 items-center rounded border border-border bg-muted/40 px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
            ⌘K
          </kbd>
        </Button>

        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
