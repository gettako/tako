"use client"

import type { ComponentType } from "react"
import {
  AlertTriangle,
  Cpu,
  Globe,
  HeartPulse,
  Key,
  Network,
  Settings,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type SettingsSection =
  | "general"
  | "domains"
  | "specs"
  | "env"
  | "networking"
  | "health"
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
    id: "danger",
    label: "Danger Zone",
    description: "Container recreation & deletion",
    icon: AlertTriangle,
  },
]

interface ServiceSettingsTabsProps {
  activeSection: SettingsSection
  onSelect: (section: SettingsSection) => void
}

export function ServiceSettingsTabs({
  activeSection,
  onSelect,
}: ServiceSettingsTabsProps) {
  return (
    <aside className="lg:sticky lg:top-6 lg:col-span-4 xl:col-span-3">
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
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
                isActive
                  ? isDanger
                    ? "bg-destructive font-semibold text-white shadow-xs"
                    : "bg-primary font-semibold text-primary-foreground shadow-xs"
                  : isDanger
                    ? "border border-destructive/40 bg-card text-destructive hover:bg-destructive/10"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      <nav
        aria-label="Service settings sections"
        className="hidden [scrollbar-width:thin] space-y-1 rounded-lg border border-border bg-card p-2 shadow-xs lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
      >
        <div className="px-3 py-2 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Service Configuration
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
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors",
                isActive
                  ? isDanger
                    ? "bg-destructive font-semibold text-white shadow-xs"
                    : "bg-primary font-semibold text-primary-foreground shadow-xs"
                  : isDanger
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="size-4 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">{tab.label}</span>
                  <span
                    className={cn(
                      "text-[10px]",
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
              </div>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
