"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpCircle, Check, ChevronRight, Copy, Loader2, Radio, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Flag } from "@/components/ui/flag"
import { OsIcon } from "@/components/ui/os-icon"
import { NodeRoleBadge } from "@/components/nodes/node-role-badge"
import { NODE_ROLE, NODE_STATUS, type ClusterNode } from "@/types/platform"
import { useUpdateNodeAgent } from "@/hooks/use-nodes"
import { copyToClipboard } from "@/lib/clipboard"
import { formatNodeLocation } from "@/lib/adapters"
import { activeStatusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"

interface NodeTableProps {
  nodes: ClusterNode[]
  onDelete?: (node: ClusterNode) => void
}

export function NodeTable({ nodes, onDelete }: NodeTableProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [updatingNodeId, setUpdatingNodeId] = React.useState<string | null>(null)
  const [updatedSuccessId, setUpdatedSuccessId] = React.useState<string | null>(null)
  const updateAgentMutation = useUpdateNodeAgent()

  const handleCopyIp = async (id: string, ip: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    if (await copyToClipboard(ip)) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleUpdateAgent = async (node: ClusterNode, e?: React.MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    setUpdatingNodeId(node.id)
    try {
      await updateAgentMutation.mutateAsync(node.id)
      setUpdatedSuccessId(node.id)
      setTimeout(() => setUpdatedSuccessId(null), 3000)
    } finally {
      setUpdatingNodeId(null)
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
            const isOnline = node.status === NODE_STATUS.ONLINE
            const loc = formatNodeLocation(node.location)
            return (
              <tr key={node.id} className="transition-colors hover:bg-muted/20">
                <td
                  className="px-4 py-3 font-medium"
                  aria-label={`Node ${node.name}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded border border-border bg-muted/40">
                      <OsIcon os={node.os} className="size-3.5" />
                    </div>
                    <div>
                      <Link
                        href={`/nodes/${node.id}`}
                        className="font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                      >
                        {node.name}
                      </Link>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {loc.display ? `${loc.display} • ${node.os}` : node.os}
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
                  <div className="flex items-center gap-1.5">
                    {node.location?.flag && (
                      <Flag
                        src={node.location.flag}
                        alt={loc.country}
                        title={loc.country}
                        width={16}
                        height={11}
                        className="h-3 shrink-0 rounded-[1px]"
                      />
                    )}
                    <span className="text-foreground">{node.ipAddress}</span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      onClick={(e) => handleCopyIp(node.id, node.ipAddress, e)}
                      className="size-5 text-muted-foreground hover:text-foreground"
                      title={
                        copiedId === node.id
                          ? "Copied IP address"
                          : "Copy IP address"
                      }
                      aria-label={
                        copiedId === node.id
                          ? "Copied IP address"
                          : "Copy IP address"
                      }
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
                      ? `Agent ${node.agentVersion || "v1.0.0"} connected`
                      : `Last heartbeat ${node.lastHeartbeat}`
                  }
                >
                  <div className="flex items-center gap-2 text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Radio
                        className={cn(
                          "size-3 shrink-0",
                          node.agentConnected
                            ? "text-emerald-500"
                            : "text-destructive"
                        )}
                      />
                      <span className="font-medium">
                        {node.agentVersion || "v1.0.0"}
                      </span>
                      {!node.agentConnected && (
                        <span className="text-[11px] text-muted-foreground">
                          ({node.lastHeartbeat})
                        </span>
                      )}
                    </div>
                    {node.agentConnected && (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={updatingNodeId === node.id}
                        onClick={(e) => handleUpdateAgent(node, e)}
                        className="size-5 text-muted-foreground transition-colors hover:text-primary"
                        title={
                          updatingNodeId === node.id
                            ? "Dispatching agent update..."
                            : updatedSuccessId === node.id
                              ? "Update signal sent!"
                              : "Update Agent to latest version"
                        }
                        aria-label="Update Agent"
                      >
                        {updatingNodeId === node.id ? (
                          <Loader2 className="size-3 animate-spin text-primary" />
                        ) : updatedSuccessId === node.id ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <ArrowUpCircle className="size-3 hover:text-primary" />
                        )}
                      </Button>
                    )}
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
                    {node.agentConnected && (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={updatingNodeId === node.id}
                        onClick={(e) => handleUpdateAgent(node, e)}
                        className="size-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        title={
                          updatingNodeId === node.id
                            ? "Updating Agent..."
                            : updatedSuccessId === node.id
                              ? "Agent update dispatched"
                              : "Update Agent to latest version"
                        }
                      >
                        {updatingNodeId === node.id ? (
                          <Loader2 className="size-3.5 animate-spin text-primary" />
                        ) : updatedSuccessId === node.id ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <ArrowUpCircle className="size-3.5" />
                        )}
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={node.role === NODE_ROLE.MASTER}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (node.role !== NODE_ROLE.MASTER) {
                            onDelete(node)
                          }
                        }}
                        className={cn(
                          "size-7",
                          node.role === NODE_ROLE.MASTER
                            ? "cursor-not-allowed text-muted-foreground/25 hover:bg-transparent hover:text-muted-foreground/25"
                            : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        )}
                        title={
                          node.role === NODE_ROLE.MASTER
                            ? "Master control plane node cannot be deleted"
                            : "Remove node"
                        }
                        aria-label={
                          node.role === NODE_ROLE.MASTER
                            ? "Master node cannot be deleted"
                            : "Remove node"
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                    <Link
                      href={`/nodes/${node.id}`}
                      className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      title="Inspect node telemetry"
                      aria-label={`Inspect ${node.name} telemetry`}
                    >
                      <ChevronRight className="size-4" />
                    </Link>
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
