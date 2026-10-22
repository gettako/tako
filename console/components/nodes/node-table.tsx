"use client"

import * as React from "react"
import Link from "next/link"
import { Check, ChevronRight, Copy, Radio, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NodeRoleBadge } from "@/components/nodes/node-role-badge"
import { ClusterNode } from "@/types/platform"
import { copyToClipboard } from "@/lib/clipboard"
import { activeStatusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"

interface NodeTableProps {
  nodes: ClusterNode[]
  onDelete?: (id: string) => void
}

export function NodeTable({ nodes, onDelete }: NodeTableProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const handleCopyIp = async (id: string, ip: string) => {
    if (await copyToClipboard(ip)) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-muted/30 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3">Node</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">IP Address</th>
            <th className="px-4 py-3">Agent</th>
            <th className="px-4 py-3">CPU</th>
            <th className="px-4 py-3">Memory</th>
            <th className="px-4 py-3">Disk</th>
            <th className="px-4 py-3">Containers</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {nodes.map((node) => {
            const isOnline = node.status === "online"
            return (
              <tr key={node.id} className="transition-colors hover:bg-muted/20">
                <td
                  className="px-4 py-3 font-medium"
                  aria-label={`Node ${node.name}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded border border-border bg-muted/40">
                      <Radio className="size-3.5 text-primary" />
                    </div>
                    <div>
                      <Link
                        href={`/nodes/${node.id}`}
                        className="font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                      >
                        {node.name}
                      </Link>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {node.os}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <NodeRoleBadge role={node.role} />
                </td>

                <td className="px-4 py-3" aria-label={`Status ${node.status}`}>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px]">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        activeStatusDotClass(isOnline)
                      )}
                    />
                    <span className="capitalize">{node.status}</span>
                  </div>
                </td>

                <td
                  className="px-4 py-3 font-mono text-muted-foreground"
                  aria-label={`IP ${node.ipAddress}`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-foreground">{node.ipAddress}</span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => handleCopyIp(node.id, node.ipAddress)}
                      className="size-5 text-muted-foreground hover:text-foreground"
                      title="Copy"
                    >
                      {copiedId === node.id ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>
                  </div>
                </td>

                <td
                  className="px-4 py-3 font-mono"
                  aria-label={
                    node.agentConnected
                      ? "Agent connected"
                      : `Last heartbeat ${node.lastHeartbeat}`
                  }
                >
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Radio
                      className={cn(
                        "size-3",
                        node.agentConnected
                          ? "text-emerald-500"
                          : "text-destructive"
                      )}
                    />
                    <span>
                      {node.agentConnected ? "live" : node.lastHeartbeat}
                    </span>
                  </div>
                </td>

                <td
                  className="px-4 py-3 font-mono"
                  aria-label={`CPU ${node.cpuPercent}%`}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${node.cpuPercent}%` }}
                      />
                    </div>
                    <span>{node.cpuPercent}%</span>
                  </div>
                </td>

                <td
                  className="px-4 py-3 font-mono"
                  aria-label={`Memory ${node.memoryPercent}%`}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${node.memoryPercent}%` }}
                      />
                    </div>
                    <span>{node.memoryPercent}%</span>
                  </div>
                </td>

                <td
                  className="px-4 py-3 font-mono"
                  aria-label={`Disk ${node.diskPercent}%`}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-muted-foreground/60"
                        style={{ width: `${node.diskPercent}%` }}
                      />
                    </div>
                    <span>{node.diskPercent}%</span>
                  </div>
                </td>

                <td className="px-4 py-3 font-mono text-foreground">
                  {node.servicesCount}
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/nodes/${node.id}`}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted"
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
                        className="size-7 text-muted-foreground hover:text-destructive"
                        title="Remove node"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
