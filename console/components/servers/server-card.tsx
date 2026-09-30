"use client"

import * as React from "react"
import Link from "next/link"
import {
  Copy,
  Check,
  Cube,
  ArrowRight,
  Cpu,
  HardDrive,
  HardDrives,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import type { Server } from "@/lib/api"
import { cn } from "@/lib/utils"

export interface ServerCardProps {
  server: Server
}

function resolveRegion(server: Server): string {
  const name = server.name.toLowerCase()
  if (name.includes("local") || server.host === "127.0.0.1") return "Local"
  if (name.includes("us-east") || name.includes("virginia")) return "US-East"
  if (name.includes("eu-central") || name.includes("frankfurt"))
    return "EU-Central"
  if (name.includes("eu")) return "EU"
  if (name.includes("us")) return "US"
  if (name.includes("asia") || name.includes("tokyo")) return "Asia-East"
  return "Node"
}

export function ServerCard({ server }: ServerCardProps) {
  const { copy: copyIp, isCopied: copiedIp } = useCopyToClipboard(2000)
  const region = resolveRegion(server)

  const handleCopyIp = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await copyIp(server.host)
  }

  const ramDisplay = React.useMemo(() => {
    if (server.ram_total_bytes > 0) {
      const usedGb = (server.ram_used_bytes / 1073741824).toFixed(1)
      const totalGb = (server.ram_total_bytes / 1073741824).toFixed(1)
      return `${usedGb} GB / ${totalGb} GB`
    }
    return `${server.ram_percent.toFixed(1)}%`
  }, [server.ram_used_bytes, server.ram_total_bytes, server.ram_percent])

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 transition-colors">
      <div className="flex flex-col gap-4">
        {/* Header: Title, Region, Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span
              className="truncate font-heading text-base font-semibold text-foreground"
              title={server.name}
            >
              {server.name}
            </span>

            {/* Host IP with copy button and Region tag */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-2xs">{server.host}</span>
                <button
                  type="button"
                  onClick={handleCopyIp}
                  className="inline-flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Copy IP address ${server.host}`}
                >
                  {copiedIp ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </div>
              <span
                className="font-mono text-3xs text-muted-foreground/40"
                aria-hidden="true"
              >
                •
              </span>
              <span className="shrink-0 rounded border border-border bg-muted/60 px-1.5 py-0.5 text-3xs font-medium text-muted-foreground">
                {region}
              </span>
            </div>
          </div>

          <StatusBadge
            variant={
              server.status === "online"
                ? "online"
                : server.status === "offline"
                  ? "offline"
                  : "pending"
            }
            showDot
            className="shrink-0"
          />
        </div>

        {/* Assigned Services Count */}
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Cube className="size-4 text-foreground" />
            <span>Assigned Services</span>
          </div>
          <Link
            href={`/servers/${server.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {server.active_services_count}{" "}
            {server.active_services_count === 1 ? "service" : "services"}
          </Link>
        </div>

        {/* Hardware Utilization Metrics */}
        <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3">
          {/* CPU Metric */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Cpu className="size-3.5" />
                <span>CPU Usage</span>
              </span>
              <span className="font-mono text-2xs font-medium text-foreground">
                {server.cpu_percent.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  server.cpu_percent > 80
                    ? "bg-rose-500"
                    : server.cpu_percent > 60
                      ? "bg-amber-500"
                      : "bg-primary"
                )}
                style={{ width: `${Math.min(100, server.cpu_percent)}%` }}
              />
            </div>
          </div>

          {/* RAM Metric */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <HardDrives className="size-3.5" />
                <span>Memory</span>
              </span>
              <span className="font-mono text-2xs font-medium text-foreground">
                {ramDisplay}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  server.ram_percent > 80
                    ? "bg-rose-500"
                    : server.ram_percent > 60
                      ? "bg-amber-500"
                      : "bg-primary"
                )}
                style={{ width: `${Math.min(100, server.ram_percent)}%` }}
              />
            </div>
          </div>

          {/* Disk Metric */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <HardDrive className="size-3.5" />
                <span>Disk</span>
              </span>
              <span className="font-mono text-2xs font-medium text-foreground">
                {server.disk_percent.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  server.disk_percent > 85
                    ? "bg-rose-500"
                    : server.disk_percent > 70
                      ? "bg-amber-500"
                      : "bg-primary"
                )}
                style={{ width: `${Math.min(100, server.disk_percent)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer: Agent version & Link */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs text-muted-foreground">
            {`Agent: ${server.agent_version}`}
          </span>
          {server.agent_version_mismatch && (
            <span className="inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-3xs font-medium text-amber-700 dark:text-amber-400">
              Agent outdated
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/servers/${server.id}`} />}
          className="h-8 gap-1.5 px-3 text-xs"
        >
          <span>View Details</span>
          <ArrowRight className="size-3" />
        </Button>
      </div>
    </div>
  )
}
