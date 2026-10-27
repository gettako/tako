"use client"

import * as React from "react"
import { FolderGit2, Layers, Plus, Radio, Server } from "lucide-react"

import { AddNodeDialog } from "@/components/nodes/add-node-dialog"
import { DeleteNodeDialog } from "@/components/nodes/delete-node-dialog"
import { NodeCard } from "@/components/nodes/node-card"
import { NodeTable } from "@/components/nodes/node-table"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog"
import { ProjectCard } from "@/components/projects/project-card"
import { ProjectTable } from "@/components/projects/project-table"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ViewModeToggle } from "@/components/ui/view-mode-toggle"
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"
import { ClusterNode, Project } from "@/types/platform"

export function DashboardView() {
  const {
    nodes,
    projects,
    services,
    nodesViewMode,
    setNodesViewMode,
    projectsViewMode,
    setProjectsViewMode,
    deleteNode,
    deleteProject,
    setDataMode,
  } = usePlatformData()

  const [addNodeOpen, setAddNodeOpen] = React.useState(false)
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
  const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(
    null
  )
  const [nodeToDelete, setNodeToDelete] = React.useState<ClusterNode | null>(
    null
  )

  // Aggregates computed accurately from online edge nodes
  const onlineNodes = React.useMemo(
    () => nodes.filter((n) => n.status === "online"),
    [nodes]
  )
  const totalCores = nodes.reduce((acc, n) => acc + n.totalCores, 0)
  const totalMemory = nodes.reduce((acc, n) => acc + n.totalMemoryGb, 0)
  const avgCpu =
    onlineNodes.length > 0
      ? Math.round(
          onlineNodes.reduce((acc, n) => acc + n.cpuPercent, 0) /
            onlineNodes.length
        )
      : 0
  const avgMem =
    onlineNodes.length > 0
      ? Math.round(
          onlineNodes.reduce((acc, n) => acc + n.memoryPercent, 0) /
            onlineNodes.length
        )
      : 0
  const avgLatency =
    onlineNodes.length > 0
      ? Math.max(
          1,
          Math.round(
            onlineNodes.reduce((acc, n) => acc + (n.grpcLatencyMs || 0), 0) /
              onlineNodes.length
          )
        )
      : null

  const hasData = nodes.length > 0 || projects.length > 0

  return (
    <div className="space-y-8">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Cluster Telemetry & Control
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Real-time gRPC node coordination and automated container deployment
            platform.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => setAddNodeOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Server className="size-3.5" />
            <span>Connect Node</span>
          </Button>

          <Button
            size="md"
            onClick={() => setCreateProjectOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            <span>New Project</span>
          </Button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Nodes */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>Edge Nodes</span>
            <Server className="size-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {nodes.length}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              ({nodes.filter((n) => n.status === "online").length} online)
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">
            {totalCores} vCPUs • {totalMemory} GB RAM
          </div>
        </div>

        {/* Projects */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>Active Projects</span>
            <FolderGit2 className="size-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {projects.length}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              scopes
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">
            Production & Staging environments
          </div>
        </div>

        {/* Services */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>Deployed Services</span>
            <Layers className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {services.length}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              ({services.filter((s) => s.status === "running").length} running)
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">
            Dockerfile & Compose stacks
          </div>
        </div>

        {/* gRPC Ingestion */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>gRPC Telemetry</span>
            <Radio
              className={cn(
                "size-4",
                onlineNodes.length > 0
                  ? "animate-pulse text-emerald-500"
                  : "text-muted-foreground"
              )}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {avgLatency !== null ? `${avgLatency}ms` : "Offline"}
            </span>
            <span
              className={cn(
                "font-mono text-xs",
                onlineNodes.length > 0
                  ? "text-emerald-500"
                  : "text-muted-foreground"
              )}
            >
              {onlineNodes.length > 0 ? "Stream live" : "No active nodes"}
            </span>
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">
            {onlineNodes.length > 0
              ? `Avg load: ${avgCpu}% CPU, ${avgMem}% RAM`
              : "Avg latency to edge agents"}
          </div>
        </div>
      </div>

      {/* When Empty State is active */}
      {!hasData && (
        <EmptyState
          icon={Server}
          title="Cluster Has No Active Workloads"
          description="You are currently viewing the clean zero-state. Connect your first edge agent or switch back to sample data using the button below."
          actionLabel="Connect Edge Node"
          onAction={() => setAddNodeOpen(true)}
          secondaryActionLabel="Load Sample Data"
          onSecondaryAction={() => setDataMode(true)}
        />
      )}

      {/* Nodes Section */}
      {nodes.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Edge Nodes ({nodes.length})
              </h2>
            </div>

            <ViewModeToggle
              mode={nodesViewMode}
              onModeChange={setNodesViewMode}
            />
          </div>

          {nodesViewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  onDelete={setNodeToDelete}
                />
              ))}
            </div>
          ) : (
            <NodeTable nodes={nodes} onDelete={setNodeToDelete} />
          )}
        </section>
      )}

      {/* Projects Section */}
      {projects.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Active Projects ({projects.length})
              </h2>
            </div>

            <ViewModeToggle
              mode={projectsViewMode}
              onModeChange={setProjectsViewMode}
            />
          </div>

          {projectsViewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={setProjectToDelete}
                />
              ))}
            </div>
          ) : (
            <ProjectTable projects={projects} onDelete={setProjectToDelete} />
          )}
        </section>
      )}

      {/* Dialogs */}
      <AddNodeDialog open={addNodeOpen} onOpenChange={setAddNodeOpen} />
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />
      <DeleteProjectDialog
        project={projectToDelete}
        open={!!projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
        onConfirm={deleteProject}
      />
      <DeleteNodeDialog
        node={nodeToDelete}
        open={!!nodeToDelete}
        onOpenChange={(open) => !open && setNodeToDelete(null)}
        onConfirm={deleteNode}
      />
    </div>
  )
}
