"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  GaugeIcon,
  RocketLaunchIcon,
  GlobeIcon,
  TerminalWindowIcon,
  TerminalIcon,
  SlidersHorizontalIcon,
  CpuIcon,
  ArchiveIcon,
  GearIcon,
} from "@phosphor-icons/react"
import { useService } from "./service-context"
import { cn } from "@/lib/utils"

interface TabItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export function ServiceTabs() {
  const { serviceId, projectId, service } = useService()
  const pathname = usePathname()

  const baseUrl = `/projects/${projectId}/services/${serviceId}`
  const isDatabase = service?.service_type === "database"

  const allTabs: TabItem[] = [
    {
      id: "overview",
      label: "Overview",
      href: baseUrl,
      icon: GaugeIcon,
    },
    {
      id: "deployments",
      label: "Deployments",
      href: `${baseUrl}/deployments`,
      icon: RocketLaunchIcon,
    },
    {
      id: "auxiliary",
      label: "Auxiliary",
      href: `${baseUrl}/auxiliary`,
      icon: CpuIcon,
    },
    {
      id: "domains",
      label: "Domains",
      href: `${baseUrl}/domains`,
      icon: GlobeIcon,
    },
    {
      id: "monitoring",
      label: "Monitoring",
      href: `${baseUrl}/monitoring`,
      icon: TerminalWindowIcon,
    },
    {
      id: "terminal",
      label: "Terminal",
      href: `${baseUrl}/terminal`,
      icon: TerminalIcon,
    },
    {
      id: "backups",
      label: "Backups",
      href: `${baseUrl}/backups`,
      icon: ArchiveIcon,
    },
    {
      id: "environment",
      label: "Environment",
      href: `${baseUrl}/environment`,
      icon: SlidersHorizontalIcon,
    },
    {
      id: "settings",
      label: "Settings",
      href: `${baseUrl}/settings`,
      icon: GearIcon,
    },
  ]

  const tabs = isDatabase
    ? allTabs.filter((tab) =>
        [
          "overview",
          "backups",
          "monitoring",
          "terminal",
          "environment",
          "settings",
        ].includes(tab.id)
      )
    : allTabs

  const isTabActive = (tab: TabItem) => {
    if (tab.id === "overview") {
      return (
        pathname === baseUrl ||
        pathname === `${baseUrl}/` ||
        pathname === `${baseUrl}/overview`
      )
    }
    return pathname.startsWith(tab.href)
  }

  return (
    <nav
      aria-label="Service tabs"
      className="inline-flex w-full scrollbar-none overflow-x-auto rounded-md border border-border bg-muted/40 p-1"
    >
      <div className="flex w-full min-w-max items-center gap-1">
        {tabs.map((tab) => {
          const active = isTabActive(tab)
          const Icon = tab.icon

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm px-3.5 text-sm font-medium transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                active
                  ? "border border-border bg-background font-semibold text-foreground"
                  : "border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
