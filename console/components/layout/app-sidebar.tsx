"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, ExternalLink, Radio } from "lucide-react"
import { motion } from "motion/react"

import { sidebarNavigationGroups } from "@/config/navigation"
import { siteConfig } from "@/config/site"
import { isNavigationItemActive } from "@/lib/navigation"
import { cn } from "@/lib/utils"

interface AppSidebarProps {
  isCollapsed: boolean
  navBadges: Record<string, string | undefined>
}

export function AppSidebar({ isCollapsed, navBadges }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out select-none lg:flex",
        isCollapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Brand Header: Exactly h-14 to seamlessly align with the top header border */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border px-4",
          isCollapsed && "justify-center px-2"
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 overflow-hidden font-semibold tracking-tight transition-opacity hover:opacity-85"
          title={isCollapsed ? siteConfig.name : undefined}
        >
          <Image
            src="/images/octopy-trim.png"
            alt={siteConfig.name}
            width={28}
            height={28}
            className="size-7 shrink-0 rounded-sm object-contain"
            priority
          />
          {!isCollapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold tracking-tight text-foreground">
                {siteConfig.name}
              </span>
              <span className="truncate font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Edge Orchestrator
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Links: Independent Vertical Scroll */}
      <nav className="flex-1 space-y-4 overflow-y-auto p-2.5">
        {sidebarNavigationGroups.map((group, groupIdx) => (
          <div key={group.title} className="space-y-1">
            {!isCollapsed ? (
              <div className="px-2.5 pb-1 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.title}
              </div>
            ) : groupIdx > 0 ? (
              <div className="mx-1 my-2 border-t border-border/40" />
            ) : null}

            {group.items.map((item) => {
              const active = isNavigationItemActive(pathname, item.href)
              const badge = navBadges[item.href]
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={cn(
                    "relative flex items-center rounded-md text-sm font-medium transition-colors duration-150",
                    isCollapsed
                      ? "justify-center p-2.5"
                      : "justify-between px-3 py-2",
                    active
                      ? "font-semibold text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active-indicator"
                      className="absolute inset-0 rounded-md bg-primary"
                      transition={{
                        type: "spring",
                        stiffness: 450,
                        damping: 35,
                      }}
                    />
                  )}
                  <div
                    className={cn(
                      "relative z-10 flex items-center gap-2.5",
                      isCollapsed && "justify-center"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!isCollapsed && <span>{item.name}</span>}
                  </div>
                  {!isCollapsed && badge && (
                    <span
                      className={cn(
                        "relative z-10 rounded px-1.5 py-0.5 font-mono text-[11px]",
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {badge}
                    </span>
                  )}
                  {isCollapsed && badge && (
                    <span className="sr-only">({badge})</span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Documentation External Navigation */}
      <div className="shrink-0 border-t border-border p-2">
        <a
          href="https://docs.gettako.dev"
          target="_blank"
          rel="noopener noreferrer"
          title={isCollapsed ? "Documentation (docs.gettako.dev)" : undefined}
          className={cn(
            "flex items-center rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isCollapsed ? "justify-center p-2.5" : "justify-between px-3 py-2"
          )}
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="size-4 shrink-0" />
            {!isCollapsed && <span>Documentation</span>}
          </div>
          {!isCollapsed && (
            <ExternalLink className="size-3 text-muted-foreground/60" />
          )}
        </a>
      </div>

      {/* gRPC Master Status Card */}
      <div className="shrink-0 border-t border-border p-2.5">
        {isCollapsed ? (
          <div
            className="flex justify-center rounded-md border border-border bg-muted/40 p-2"
            title="Master Daemon: gRPC Transport Online (Port 50051)"
          >
            <Radio className="size-4 animate-pulse text-emerald-500" />
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase">
                Master Daemon
              </span>
              <span className="flex size-2 animate-pulse rounded-full bg-emerald-500" />
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
              <Radio className="size-3.5 text-emerald-500" />
              <span>gRPC Transport Online</span>
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              Port: <span className="text-foreground">50051</span> (mTLS active)
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
