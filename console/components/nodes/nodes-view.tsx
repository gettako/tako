"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Radio, Search, Server } from "lucide-react"

import { AddNodeDialog } from "@/components/nodes/add-node-dialog"
import { DeleteNodeDialog } from "@/components/nodes/delete-node-dialog"
import { NodeCard } from "@/components/nodes/node-card"
import { NodeTable } from "@/components/nodes/node-table"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { ViewModeToggle } from "@/components/ui/view-mode-toggle"
import { usePlatformData } from "@/context/platform-data-context"
import { ClusterNode } from "@/types/platform"

export function NodesView() {
  const { nodes, nodesViewMode, setNodesViewMode, deleteNode } =
    usePlatformData()

  const [addNodeOpen, setAddNodeOpen] = React.useState(false)
  const [nodeToDelete, setNodeToDelete] = React.useState<ClusterNode | null>(
    null
  )
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredNodes = nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.ipAddress.includes(searchQuery) ||
      n.os.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Edge Infrastructure Nodes
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage physical and cloud servers running the Tako Golang edge
            telemetry agent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/live">
            <Button
              size="md"
              variant="outline"
              className="shrink-0 gap-1.5 text-xs text-foreground hover:border-emerald-500/50 hover:bg-emerald-500/10"
            >
              <Radio className="size-3.5 animate-pulse text-emerald-500" />
              <span>Live Traffic</span>
            </Button>
          </Link>

          <Button
            size="md"
            onClick={() => setAddNodeOpen(true)}
            className="shrink-0 gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            <span>Connect Node</span>
          </Button>
        </div>
      </div>

      {/* Toolbar: Search + View Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Filter nodes by hostname or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            Showing {filteredNodes.length} of {nodes.length} nodes
          </span>
          <ViewModeToggle
            mode={nodesViewMode}
            onModeChange={setNodesViewMode}
          />
        </div>
      </div>

      {/* Empty State when no nodes exist */}
      {nodes.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No Edge Nodes Connected"
          description="Your cluster currently has no connected edge agents. Run the installation script on your remote host to enroll one."
          actionLabel="Connect Edge Node"
          onAction={() => setAddNodeOpen(true)}
        />
      ) : filteredNodes.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No Matching Nodes Found"
          description={`No nodes matched "${searchQuery}". Check the spelling or clear the filter.`}
          actionLabel="Clear Filter"
          onAction={() => setSearchQuery("")}
        />
      ) : nodesViewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filteredNodes.map((node) => (
            <NodeCard key={node.id} node={node} onDelete={setNodeToDelete} />
          ))}
        </div>
      ) : (
        <NodeTable nodes={filteredNodes} onDelete={setNodeToDelete} />
      )}

      <AddNodeDialog open={addNodeOpen} onOpenChange={setAddNodeOpen} />
      <DeleteNodeDialog
        node={nodeToDelete}
        open={!!nodeToDelete}
        onOpenChange={(open) => !open && setNodeToDelete(null)}
        onConfirm={deleteNode}
      />
    </div>
  )
}
