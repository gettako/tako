"use client"

import * as React from "react"
import Link from "next/link"
import {
  Check,
  ChevronRight,
  Copy,
  Cpu,
  HardDrive,
  Radio,
  Server,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Flag } from "@/components/ui/flag"
import { NodeRoleBadge } from "@/components/nodes/node-role-badge"
import { ClusterNode } from "@/types/platform"
import { copyToClipboard } from "@/lib/clipboard"
import { activeStatusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"

interface NodeCardProps {
  node: ClusterNode
  onDelete?: (id: string) => void
}

export function NodeCard({ node, onDelete }: NodeCardProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopyIp = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (await copyToClipboard(node.ipAddress)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isOnline = node.status === "online"

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5 transition-all hover:border-border/80">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded border border-border bg-muted/40">
            <Server className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/nodes/${node.id}`}
                className="truncate text-sm font-semibold text-foreground transition-colors hover:text-primary"
              >
                {node.name}
              </Link>
              <NodeRoleBadge role={node.role} />
            </div>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {node.location?.name
                ? `${node.location.name} • ${node.os}`
                : node.os}
            </p>
          </div>
        </div>

        {/* Status Chip */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs">
          <span
            className={cn(
              "size-1.5 rounded-full",
              activeStatusDotClass(isOnline)
            )}
          />
          <span className="text-[11px] font-medium text-foreground capitalize">
            {node.status}
          </span>
        </div>
      </div>

      {/* Connection & IP */}
      <div className="mt-4 flex items-center justify-between gap-2 border-y border-border/70 py-2.5 font-mono text-xs">
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          {node.location?.flag && (
            <Flag
              src={node.location.flag}
              alt={node.location.name}
              width={16}
              height={11}
              className="h-3 shrink-0 rounded-[1px]"
            />
          )}
          <span className="shrink-0">IP:</span>
          <code className="truncate text-foreground">{node.ipAddress}</code>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={handleCopyIp}
            className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
            title="Copy IP"
          >
            {copied ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        </div>

        <div
          className="flex shrink-0 items-center gap-1.5 text-muted-foreground"
          title={
            node.agentConnected
              ? "Agent connected"
              : `Agent disconnected (${node.lastHeartbeat})`
          }
          aria-label={
            node.agentConnected
              ? "Agent connected"
              : `Last heartbeat ${node.lastHeartbeat}`
          }
        >
          <Radio
            className={cn(
              "size-3.5",
              node.agentConnected ? "text-emerald-500" : "text-destructive"
            )}
          />
          {!node.agentConnected && (
            <span className="text-foreground">{node.lastHeartbeat}</span>
          )}
        </div>
      </div>

      {/* Metrics Gauges */}
      <div className="mt-4 space-y-2.5 text-xs">
        {/* CPU */}
        <div>
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Cpu className="size-3" /> CPU ({node.totalCores} cores)
            </span>
            <span className="font-semibold text-foreground">
              {node.cpuPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                node.cpuPercent > 80
                  ? "bg-destructive"
                  : node.cpuPercent > 60
                    ? "bg-amber-500"
                    : "bg-primary"
              )}
              style={{ width: `${node.cpuPercent}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Server className="size-3" /> Memory ({node.totalMemoryGb} GiB)
            </span>
            <span className="font-semibold text-foreground">
              {node.memoryPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                node.memoryPercent > 80
                  ? "bg-destructive"
                  : node.memoryPercent > 60
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              )}
              style={{ width: `${node.memoryPercent}%` }}
            />
          </div>
        </div>

        {/* Disk */}
        <div>
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <HardDrive className="size-3" /> Disk
            </span>
            <span className="font-semibold text-foreground">
              {node.diskPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-muted-foreground/60 transition-all"
              style={{ width: `${node.diskPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
        <div>
          <span>Docker: </span>
          <span className="font-medium text-foreground">
            {node.dockerVersion}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>{node.servicesCount} services</span>
          <Link
            href={`/nodes/${node.id}`}
            className="inline-flex items-center gap-1 text-primary hover:underline"
            title="Inspect node telemetry"
          >
            <span>View</span>
            <ChevronRight className="size-3" />
          </Link>
          {onDelete && node.role !== "master" && (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => onDelete(node.id)}
              className="size-6 text-muted-foreground hover:text-destructive"
              title="Remove node"
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
