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
  Radio,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type SettingsSection =
  | "overview"
  | "users"
  | "registries"
  | "storage"
  | "git"
  | "backups"
  | "domain"
  | "notifications"
  | "network"

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
}

export function SettingsNav({
  activeSection,
  onSectionChange,
  pendingInvitesCount = 0,
  bucketsCount,
  registriesCount,
}: SettingsNavProps) {
  const navItems: NavItem[] = React.useMemo(
    () => [
      {
        id: "overview",
        label: "Overview",
        description: "Cluster health, consensus & version",
        icon: LayoutDashboard,
      },
      {
        id: "users",
        label: "Team & RBAC",
        description: "Members, roles, and invite links",
        icon: Users,
        badge: pendingInvitesCount > 0 ? pendingInvitesCount : undefined,
      },
      {
        id: "registries",
        label: "Docker Registries",
        description: "Private GHCR & Docker Hub access",
        icon: Boxes,
        badge:
          registriesCount && registriesCount > 0 ? registriesCount : undefined,
      },
      {
        id: "storage",
        label: "S3 Object Storage",
        description: "Artifacts, volume & db snapshots",
        icon: HardDrive,
        badge: bucketsCount && bucketsCount > 0 ? `${bucketsCount}` : undefined,
      },
      {
        id: "git",
        label: "Git Providers",
        description: "GitHub App & PAT synced repos",
        icon: FolderGit2,
      },
      {
        id: "backups",
        label: "Backups & Snapshots",
        description: "Automated snapshots & restore state",
        icon: Archive,
      },
      {
        id: "domain",
        label: "Cluster Domain",
        description: "Control plane DNS & TLS certs",
        icon: Globe,
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "Discord, Slack, Email & Telegram",
        icon: Bell,
      },
      {
        id: "network",
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
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
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
            </button>
          )
        })}
      </div>

      {/* Desktop Vertical Sidebar */}
      <nav
        aria-label="Cluster Settings navigation"
        className="hidden [scrollbar-width:thin] space-y-1 rounded-lg border border-border bg-card p-2 shadow-xs lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
      >
        <div className="px-3 py-2 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Cluster Configuration
        </div>

        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Icon className="size-4 shrink-0" />
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
              </div>

              {item.badge !== undefined && (
                <span
                  className={cn(
                    "ml-2 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "border border-border/50 bg-muted text-muted-foreground"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </>
  )
}
