"use client"

import * as React from "react"
import {
  Archive,
  Bell,
  Boxes,
  FolderGit2,
  Globe,
  HardDrive,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { motion } from "motion/react"

export const SETTINGS_SECTION = {
  OVERVIEW: "overview",
  USERS: "users",
  REGISTRIES: "registries",
  STORAGE: "storage",
  GIT: "git",
  BACKUPS: "backups",
  DOMAIN: "domain",
  NOTIFICATIONS: "notifications",
  NETWORK: "network",
} as const

export type SettingsSection =
  (typeof SETTINGS_SECTION)[keyof typeof SETTINGS_SECTION]

interface NavItem {
  id: SettingsSection
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
}

interface SettingsNavProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
  pendingInvitesCount?: number
  bucketsCount?: number
  registriesCount?: number
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function SettingsNav({
  activeSection,
  onSectionChange,
  pendingInvitesCount = 0,
  bucketsCount,
  registriesCount,
  isCollapsed = false,
  onToggleCollapse,
}: SettingsNavProps) {
  const navItems: NavItem[] = React.useMemo(
    () => [
      {
        id: SETTINGS_SECTION.OVERVIEW,
        label: "Overview",
        description: "Cluster health, consensus & version",
        icon: LayoutDashboard,
      },
      {
        id: SETTINGS_SECTION.USERS,
        label: "Team & RBAC",
        description: "Members, roles, and invite links",
        icon: Users,
        badge: pendingInvitesCount > 0 ? pendingInvitesCount : undefined,
      },
      {
        id: SETTINGS_SECTION.REGISTRIES,
        label: "Docker Registries",
        description: "Private GHCR & Docker Hub access",
        icon: Boxes,
        badge:
          registriesCount && registriesCount > 0 ? registriesCount : undefined,
      },
      {
        id: SETTINGS_SECTION.STORAGE,
        label: "S3 Object Storage",
        description: "Artifacts, volume & db snapshots",
        icon: HardDrive,
        badge: bucketsCount && bucketsCount > 0 ? `${bucketsCount}` : undefined,
      },
      {
        id: SETTINGS_SECTION.GIT,
        label: "Git Providers",
        description: "GitHub App & PAT synced repos",
        icon: FolderGit2,
      },
      {
        id: SETTINGS_SECTION.BACKUPS,
        label: "Backups & Snapshots",
        description: "Automated snapshots & restore state",
        icon: Archive,
      },
      {
        id: SETTINGS_SECTION.DOMAIN,
        label: "Cluster Domain",
        description: "Control plane DNS & TLS certs",
        icon: Globe,
      },
      {
        id: SETTINGS_SECTION.NOTIFICATIONS,
        label: "Notifications",
        description: "Discord, Slack, Email & Telegram",
        icon: Bell,
      },
      {
        id: SETTINGS_SECTION.NETWORK,
        label: "Daemon & Security",
        description: "gRPC mTLS, token & IP allowlist",
        icon: Radio,
      },
    ],
    [pendingInvitesCount, bucketsCount, registriesCount]
  )

  return (
    <>
      {/* Mobile Horizontal Scrollable Tabs */}
      <div className="flex scrollbar-none gap-1.5 overflow-x-auto pb-2 lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault()
                  onSectionChange(item.id)
                }
              }}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                isActive
                  ? "font-semibold text-primary-foreground shadow-xs"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="settings-nav-mobile-active"
                  className="absolute inset-0 rounded-md bg-primary"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="size-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={cn(
                      "py-0.2 rounded px-1.5 font-mono text-[10px]",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </span>
            </a>
          )
        })}
      </div>

      {/* Desktop Vertical Sidebar */}
      <nav
        aria-label="Cluster Settings navigation"
        className={cn(
          "hidden [scrollbar-width:thin] space-y-1 rounded-lg border border-border bg-card shadow-xs transition-all duration-200 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto",
          isCollapsed ? "p-1.5" : "p-2"
        )}
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          {!isCollapsed && (
            <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase truncate">
              Cluster Settings
            </span>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={cn(
                "flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
                isCollapsed && "mx-auto"
              )}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="size-3.5" />
              ) : (
                <PanelLeftClose className="size-3.5" />
              )}
            </button>
          )}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault()
                  onSectionChange(item.id)
                }
              }}
              title={isCollapsed ? `${item.label} — ${item.description}` : undefined}
              className={cn(
                "relative flex items-center rounded-md text-xs font-medium transition-colors cursor-pointer",
                isCollapsed
                  ? "size-9 justify-center mx-auto"
                  : "w-full justify-between px-3 py-2.5 text-left",
                isActive
                  ? "font-semibold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="settings-nav-desktop-active"
                  className="absolute inset-0 rounded-md bg-primary"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex items-center",
                  isCollapsed ? "justify-center" : "min-w-0 gap-2.5"
                )}
              >
                <Icon className={cn("shrink-0", isCollapsed ? "size-4" : "size-4")} />
                {!isCollapsed && (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{item.label}</span>
                    <span
                      className={cn(
                        "truncate text-[10px]",
                        isActive
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground/80"
                      )}
                    >
                      {item.description}
                    </span>
                  </div>
                )}
              </div>

              {!isCollapsed && item.badge !== undefined && (
                <span
                  className={cn(
                    "relative z-10 ml-2 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "border border-border/50 bg-muted text-muted-foreground"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </a>
          )
        })}
      </nav>
    </>
  )
}
