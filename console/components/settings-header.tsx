"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export interface SettingsHeaderProps {
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export const SETTINGS_TABS = [
  { label: "General", href: "/settings" },
  { label: "Users", href: "/settings/users" },
  { label: "GitHub Integration", href: "/settings/github" },
  { label: "Storage", href: "/settings/storage" },
  { label: "Backups", href: "/settings/backups" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Audit Log", href: "/settings/audit" },
] as const

export function SettingsHeader({
  title,
  description,
  action,
  className,
}: SettingsHeaderProps) {
  const pathname = usePathname()

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action ? (
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto [&_button]:h-9">
            {action}
          </div>
        ) : null}
      </div>

      {/* Tab Navigation */}
      <nav
        aria-label="Settings navigation"
        className="flex items-center gap-1 overflow-x-auto border-b border-border"
      >
        {SETTINGS_TABS.map((tab) => {
          const isActive =
            tab.href === "/settings"
              ? pathname === "/settings"
              : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
