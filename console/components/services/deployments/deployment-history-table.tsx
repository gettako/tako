"use client"

import * as React from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  GitBranch,
  GitCommit,
  Loader2,
  RotateCcw,
  Search,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DeploymentRecord } from "@/types/platform"
import { cn } from "@/lib/utils"

export interface DeploymentHistoryTableProps {
  deployments: DeploymentRecord[]
  selectedDeploymentId?: string
  onSelectDeployment: (deployment: DeploymentRecord) => void
  onRequestRollback: (deployment: DeploymentRecord) => void
  isDeploying?: boolean
  activeCommitHash?: string
}

export function DeploymentHistoryTable({
  deployments,
  selectedDeploymentId,
  onSelectDeployment,
  onRequestRollback,
  isDeploying = false,
  activeCommitHash,
}: DeploymentHistoryTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredDeployments = React.useMemo(() => {
    if (!searchQuery.trim()) return deployments
    const q = searchQuery.toLowerCase()
    return deployments.filter((dep) => {
      const hashMatch = dep.commitHash.toLowerCase().includes(q)
      const msgMatch = dep.message.toLowerCase().includes(q)
      const triggerMatch = dep.triggerBy.toLowerCase().includes(q)
      const statusMatch = dep.status.toLowerCase().includes(q)
      const branchMatch = dep.branch
        ? dep.branch.toLowerCase().includes(q)
        : false
      return hashMatch || msgMatch || triggerMatch || statusMatch || branchMatch
    })
  }, [deployments, searchQuery])

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      {/* Table Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            All Deployments
          </h3>
          <span className="rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
            {deployments.length}
          </span>
          <span className="hidden font-mono text-[11px] text-muted-foreground md:inline">
            • Click row to inspect pipeline
          </span>
        </div>

        {/* Quick Filter Search */}
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Filter commits, trigger, message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full bg-background pr-7 pl-8 font-mono text-xs sm:w-64"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-muted-foreground transition-colors hover:text-foreground"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table Structure */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="w-[180px] px-4 py-3 font-semibold">Commit</th>
              <th className="px-4 py-3 font-semibold">Message & Trigger</th>
              <th className="w-[130px] px-4 py-3 font-semibold">Status</th>
              <th className="hidden w-[160px] px-4 py-3 font-semibold sm:table-cell">
                Triggered
              </th>
              <th className="hidden w-[110px] px-4 py-3 font-semibold md:table-cell">
                Duration
              </th>
              <th className="w-[120px] px-4 py-3 text-right font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredDeployments.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center font-mono text-xs text-muted-foreground"
                >
                  <p>No deployments matching &quot;{searchQuery}&quot;</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-primary"
                  >
                    Clear search filter
                  </Button>
                </td>
              </tr>
            ) : (
              filteredDeployments.map((dep, index) => {
                const isSelected = selectedDeploymentId === dep.id
                const isCurrentActive =
                  dep.commitHash === activeCommitHash && !isDeploying
                const isRunning =
                  dep.status === "building" || (isDeploying && index === 0)

                return (
                  <tr
                    key={dep.id || index}
                    className={cn(
                      "group relative border-b border-border transition-colors last:border-b-0",
                      isSelected
                        ? "bg-primary/5 font-medium dark:bg-primary/10"
                        : "hover:bg-muted/30"
                    )}
                  >
                    {/* Commit Hash & Author */}
                    <td className="relative px-4 py-3.5">
                      {isSelected && (
                        <span
                          className="absolute inset-y-2 left-0 w-1 rounded-r bg-primary"
                          aria-hidden="true"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectDeployment(dep)}
                        className="flex flex-col gap-1 text-left outline-none focus-visible:underline"
                        aria-label={`Inspect deployment commit ${dep.commitHash}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded border border-border/80 bg-muted/40 px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground group-hover:border-primary/50">
                            <GitCommit className="size-3 text-muted-foreground" />
                            {dep.commitHash.length > 7
                              ? dep.commitHash.slice(0, 7)
                              : dep.commitHash}
                          </span>
                          {dep.isRollback && (
                            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 font-mono text-[10px] font-medium text-amber-500 uppercase">
                              Rollback
                            </span>
                          )}
                        </div>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          by {dep.triggerBy}
                        </span>
                      </button>
                    </td>

                    {/* Commit Message & Branch */}
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => onSelectDeployment(dep)}
                        className="flex max-w-xs flex-col gap-1 text-left outline-none md:max-w-md lg:max-w-lg"
                        aria-label={`Commit message: ${dep.message}`}
                      >
                        <p className="truncate font-mono text-xs font-medium text-foreground group-hover:text-primary">
                          {dep.message}
                        </p>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                          <GitBranch className="size-3 shrink-0 text-muted-foreground/70" />
                          <span>{dep.branch || "main"}</span>
                        </div>
                      </button>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => onSelectDeployment(dep)}
                        className="text-left outline-none"
                        aria-label={`Deployment status: ${dep.status}`}
                      >
                        {isRunning ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-primary">
                            <Loader2 className="size-3 animate-spin" />
                            <span>Deploying</span>
                          </div>
                        ) : dep.status === "failed" ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-rose-500">
                            <AlertTriangle className="size-3" />
                            <span>Failed</span>
                          </div>
                        ) : dep.status === "rolled_back" ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-amber-500">
                            <RotateCcw className="size-3" />
                            <span>Rolled Back</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-500">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            <span>Success</span>
                          </div>
                        )}
                      </button>
                    </td>

                    {/* Trigger Timestamp */}
                    <td className="hidden px-4 py-3.5 font-mono text-xs text-muted-foreground sm:table-cell">
                      <button
                        type="button"
                        onClick={() => onSelectDeployment(dep)}
                        className="flex flex-col text-left outline-none"
                        aria-label={`Triggered at: ${dep.startedAt}`}
                      >
                        <span className="font-medium text-foreground/90">
                          {dep.startedAt}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                          Verified Revision
                        </span>
                      </button>
                    </td>

                    {/* Duration */}
                    <td className="hidden px-4 py-3.5 font-mono text-xs text-muted-foreground md:table-cell">
                      <button
                        type="button"
                        onClick={() => onSelectDeployment(dep)}
                        className="flex items-center gap-1.5 text-left outline-none"
                        aria-label={`Duration: ${dep.duration}`}
                      >
                        <Clock className="size-3 shrink-0 text-muted-foreground/70" />
                        <span>{dep.duration}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isCurrentActive ? (
                          <div className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-emerald-500">
                            <CheckCircle2 className="size-3.5" />
                            <span className="hidden lg:inline">Active</span>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={isDeploying}
                            onClick={() => onRequestRollback(dep)}
                            className="h-7 gap-1 font-mono text-[11px] text-foreground hover:border-primary hover:text-primary"
                          >
                            <RotateCcw className="size-3 text-muted-foreground" />
                            <span className="hidden sm:inline">Rollback</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="flex flex-col gap-2 border-t border-border bg-muted/10 px-4 py-2.5 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {filteredDeployments.length} of {deployments.length} releases
        </span>
        {selectedDeploymentId && (
          <span className="text-[11px] text-primary">
            Inspecting release:{" "}
            {deployments
              .find((d) => d.id === selectedDeploymentId)
              ?.commitHash.slice(0, 7) || selectedDeploymentId}
          </span>
        )}
      </div>
    </div>
  )
}
