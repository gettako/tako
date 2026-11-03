"use client"

import type { ComponentType } from "react"
import {
  AlertTriangle,
  Archive,
  Cpu,
  Globe,
  HeartPulse,
  Key,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { motion } from "motion/react"

export type SettingsSection =
  | "general"
  | "domains"
  | "specs"
  | "env"
  | "networking"
  | "health"
  | "backups"
  | "danger"

interface ServiceSettingTabItem {
  id: SettingsSection
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}

const SERVICE_SETTINGS_TABS: ServiceSettingTabItem[] = [
  {
    id: "general",
    label: "General",
    description: "Identity, edge node & restart policy",
    icon: Settings,
  },
  {
    id: "domains",
    label: "Domains & Routing",
    description: "Hosts, paths, TLS & edge entrypoints",
    icon: Globe,
  },
  {
    id: "specs",
    label: "Compute & Resources",
    description: "CPU & RAM allocation per container",
    icon: Cpu,
  },
  {
    id: "env",
    label: "Environment Variables",
    description: "Key-value & runtime .env secrets",
    icon: Key,
  },
  {
    id: "networking",
    label: "Networking & Ports",
    description: "Port forward mappings & ingress",
    icon: Network,
  },
  {
    id: "health",
    label: "Health Checks",
    description: "Liveness probes & auto-healing",
    icon: HeartPulse,
  },
  {
    id: "backups",
    label: "Backups & S3 Storage",
    description: "Automated snapshot schedule & S3 destination",
    icon: Archive,
  },
  {
    id: "danger",
    label: "Danger Zone",
    description: "Container recreation & deletion",
    icon: AlertTriangle,
  },
]

interface ServiceSettingsTabsProps {
  activeSection: SettingsSection
  onSelect: (section: SettingsSection) => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function ServiceSettingsTabs({
  activeSection,
  onSelect,
  isCollapsed = false,
  onToggleCollapse,
}: ServiceSettingsTabsProps) {
  return (
    <aside
      className={cn(
        "w-full shrink-0 transition-[width] duration-200 ease-in-out lg:sticky lg:top-6",
        isCollapsed ? "lg:w-[68px]" : "lg:w-64"
      )}
    >
      <div className="flex scrollbar-none gap-1.5 overflow-x-auto pb-2 lg:hidden">
        {SERVICE_SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeSection === tab.id
          const isDanger = tab.id === "danger"

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
                isActive
                  ? isDanger
                    ? "font-semibold text-white shadow-xs"
                    : "font-semibold text-primary-foreground shadow-xs"
                  : isDanger
                    ? "border border-destructive/40 bg-card text-destructive hover:bg-destructive/10"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="service-settings-mobile-indicator"
                  className={cn(
                    "absolute inset-0 rounded-md",
                    isDanger ? "bg-destructive" : "bg-primary"
                  )}
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </span>
            </button>
          )
        })}
      </div>

      <nav
        aria-label="Service settings sections"
        className={cn(
          "hidden [scrollbar-width:thin] space-y-1 rounded-lg border border-border bg-card shadow-xs transition-all duration-200 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto",
          isCollapsed ? "p-1.5" : "p-2"
        )}
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          {!isCollapsed && (
            <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase truncate">
              Service Settings
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

        {SERVICE_SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeSection === tab.id
          const isDanger = tab.id === "danger"

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              title={isCollapsed ? `${tab.label} — ${tab.description}` : undefined}
              className={cn(
                "relative flex items-center rounded-md text-xs font-medium transition-colors",
                isCollapsed
                  ? "size-9 justify-center mx-auto"
                  : "w-full justify-between px-3 py-2.5 text-left",
                isActive
                  ? isDanger
                    ? "font-semibold text-white shadow-xs"
                    : "font-semibold text-primary-foreground shadow-xs"
                  : isDanger
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="service-settings-desktop-indicator"
                  className={cn(
                    "absolute inset-0 rounded-md",
                    isDanger ? "bg-destructive" : "bg-primary"
                  )}
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
                    <span className="truncate font-medium">{tab.label}</span>
                    <span
                      className={cn(
                        "truncate text-[10px]",
                        isActive
                          ? isDanger
                            ? "text-white/80"
                            : "text-primary-foreground/80"
                          : "text-muted-foreground"
                      )}
                    >
                      {tab.description}
                    </span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
