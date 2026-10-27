"use client"

import * as React from "react"
import Link from "next/link"
import {
  Boxes,
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
import { DockerIcon, OsIcon } from "@/components/ui/os-icon"
import { NodeRoleBadge } from "@/components/nodes/node-role-badge"
import { ClusterNode } from "@/types/platform"
import { copyToClipboard } from "@/lib/clipboard"
import { formatNodeLocation } from "@/lib/adapters"
import { statusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"

interface NodeCardProps {
  node: ClusterNode
  onDelete?: (node: ClusterNode) => void
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
  const loc = formatNodeLocation(node.location)

  return (
    <div className="group relative flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-xs">
      <div className="min-w-0">
        {/* Top Header: Identity, OS, Name, Role */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* OS Icon Avatar with Status Indicator Dot */}
            <div className="relative flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground">
              <OsIcon os={node.os} className="size-4" />
              <span
                className={cn(
                  "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-card",
                  statusDotClass(node.status),
                  isOnline && "animate-pulse"
                )}
                title={`Node ${node.status}`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <Link
                href={`/nodes/${node.id}`}
                className="block truncate text-sm font-semibold text-foreground transition-colors after:absolute after:inset-0 after:rounded-lg hover:text-primary hover:underline"
                title={node.name}
              >
                {node.name}
              </Link>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <span className="truncate">{node.os}</span>
                {loc.display && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span className="truncate">{loc.display}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 items-center">
            <NodeRoleBadge role={node.role} />
          </div>
        </div>

        {/* Network & Agent Connection Strip */}
        <div className="mt-2.5 flex items-center justify-between gap-2 font-mono text-[11px]">
          {/* Copyable IP Pill */}
          <button
            type="button"
            onClick={handleCopyIp}
            className="group/ip relative z-10 inline-flex items-center gap-1.5 rounded bg-muted/40 px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={`Click to copy IP (${node.ipAddress})`}
          >
            {node.location?.flag && (
              <Flag
                src={node.location.flag}
                alt={loc.country}
                title={loc.country}
                width={14}
                height={9}
                className="h-2.5 shrink-0 rounded-[1px]"
              />
            )}
            <span className="font-medium text-foreground">
              {node.ipAddress}
            </span>
            {copied ? (
              <Check className="size-3 animate-in text-emerald-500 fade-in" />
            ) : (
              <Copy className="size-2.5 opacity-50 transition-opacity group-hover/ip:opacity-100" />
            )}
          </button>

          {/* Agent Telemetry Status */}
          <div
            className="flex shrink-0 items-center gap-1.5 text-muted-foreground"
            title={
              node.agentConnected
                ? `Agent connected (${node.agentVersion || "v1.0.0"})${node.grpcLatencyMs ? ` • ${node.grpcLatencyMs}ms latency` : ""}`
                : `Agent disconnected (${node.lastHeartbeat || "never"})`
            }
          >
            <Radio
              className={cn(
                "size-3 shrink-0",
                node.agentConnected ? "text-emerald-500" : "text-destructive"
              )}
            />
            <span className="font-medium text-foreground">
              {node.agentConnected
                ? node.agentVersion || "v1.0.0"
                : node.lastHeartbeat || "offline"}
            </span>
          </div>
        </div>

        {/* 3-Row Aligned Resource Gauges */}
        <div className="mt-3 rounded-md border border-border/60 bg-muted/20 p-2.5 font-mono text-xs">
          {/* Hardware Specs Line Before Bars */}
          <div className="flex items-center justify-between border-b border-border/50 pb-2 text-[10px] text-muted-foreground">
            <span>
              <strong className="font-semibold text-foreground">
                {node.totalCores}
              </strong>{" "}
              {node.totalCores === 1 ? "Core" : "Cores"}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span>
              <strong className="font-semibold text-foreground">
                {node.totalMemoryGb}
              </strong>{" "}
              GiB RAM
            </span>
            {node.diskTotalGb ? (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>
                  <strong className="font-semibold text-foreground">
                    {node.diskTotalGb}
                  </strong>{" "}
                  GB Storage
                </span>
              </>
            ) : null}
          </div>

          <div className="space-y-2 pt-2">
            {/* Row 1: CPU */}
            <div
              className="flex items-center gap-2.5 text-[10px]"
              title={`CPU: ${node.cpuPercent}% (${node.totalCores} ${node.totalCores === 1 ? "core" : "cores"})`}
            >
              <span className="flex w-13 shrink-0 items-center gap-1.5 text-muted-foreground">
                <Cpu className="size-3 text-muted-foreground" />
                <span>CPU</span>
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    node.cpuPercent > 80
                      ? "bg-destructive"
                      : node.cpuPercent > 60
                        ? "bg-amber-500"
                        : "bg-primary"
                  )}
                  style={{ width: `${Math.min(node.cpuPercent, 100)}%` }}
                />
              </div>
              <span
                className={cn(
                  "w-9 shrink-0 text-right font-semibold text-foreground tabular-nums",
                  node.cpuPercent > 80
                    ? "text-destructive"
                    : node.cpuPercent > 60
                      ? "text-amber-500"
                      : "text-foreground"
                )}
              >
                {node.cpuPercent}%
              </span>
            </div>

            {/* Row 2: Memory (RAM) */}
            <div
              className="flex items-center gap-2.5 text-[10px]"
              title={`Memory: ${node.memoryPercent}% (${node.totalMemoryGb} GiB)`}
            >
              <span className="flex w-13 shrink-0 items-center gap-1.5 text-muted-foreground">
                <Server className="size-3 text-muted-foreground" />
                <span>RAM</span>
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    node.memoryPercent > 80
                      ? "bg-destructive"
                      : node.memoryPercent > 60
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(node.memoryPercent, 100)}%` }}
                />
              </div>
              <span
                className={cn(
                  "w-9 shrink-0 text-right font-semibold text-foreground tabular-nums",
                  node.memoryPercent > 80
                    ? "text-destructive"
                    : node.memoryPercent > 60
                      ? "text-amber-500"
                      : "text-emerald-500"
                )}
              >
                {node.memoryPercent}%
              </span>
            </div>

            {/* Row 3: Disk */}
            <div
              className="flex items-center gap-2.5 text-[10px]"
              title={`Disk: ${node.diskPercent}%${node.diskTotalGb ? ` (${node.diskTotalGb} GB)` : ""}`}
            >
              <span className="flex w-13 shrink-0 items-center gap-1.5 text-muted-foreground">
                <HardDrive className="size-3 text-muted-foreground" />
                <span>Disk</span>
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full bg-muted-foreground/60 transition-all duration-300",
                    node.diskPercent > 85 && "bg-destructive",
                    node.diskPercent > 70 &&
                      node.diskPercent <= 85 &&
                      "bg-amber-500"
                  )}
                  style={{ width: `${Math.min(node.diskPercent, 100)}%` }}
                />
              </div>
              <span
                className={cn(
                  "w-9 shrink-0 text-right font-semibold text-foreground tabular-nums",
                  node.diskPercent > 85 && "text-destructive",
                  node.diskPercent > 70 &&
                    node.diskPercent <= 85 &&
                    "text-amber-500"
                )}
              >
                {node.diskPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info & Quick Actions */}
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 font-mono text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          {/* Workload */}
          <div
            className="flex items-center gap-1 text-foreground"
            title={`${node.servicesCount} deployed services`}
          >
            <Boxes className="size-3 text-muted-foreground" />
            <span className="font-medium">
              {node.servicesCount}{" "}
              {node.servicesCount === 1 ? "service" : "services"}
            </span>
          </div>

          {/* Docker Version */}
          {node.dockerVersion && node.dockerVersion !== "unknown" && (
            <>
              <span className="text-border">•</span>
              <div
                className="flex items-center gap-1 text-muted-foreground"
                title={`Docker Engine ${node.dockerVersion}`}
              >
                <DockerIcon className="size-3" />
                <span>{node.dockerVersion}</span>
              </div>
            </>
          )}
        </div>

        <div className="relative z-10 flex items-center gap-1.5">
          {onDelete && node.role !== "master" && (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDelete(node)
              }}
              className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Remove node"
            >
              <Trash2 className="size-3" />
            </Button>
          )}
          <Link
            href={`/nodes/${node.id}`}
            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
            title="Inspect node telemetry"
          >
            <span>Manage</span>
            <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
