"use client"

import * as React from "react"
import {
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  RotateCw,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/ui/empty-state"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api"
import type { ApiCronJob, ApiCronRun } from "@/lib/api"
import type { ProjectService } from "@/types/platform"
import { cn } from "@/lib/utils"

interface ServiceCronsTabProps {
  service: ProjectService
}

const CRON_PRESETS = [
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily (Midnight)", value: "0 0 * * *" },
  { label: "Weekly (Sunday)", value: "0 0 * * 0" },
]

export function ServiceCronsTab({ service }: ServiceCronsTabProps) {
  const [crons, setCrons] = React.useState<ApiCronJob[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [createName, setCreateName] = React.useState("")
  const [createSchedule, setCreateSchedule] = React.useState("0 * * * *")
  const [createCommand, setCreateCommand] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Run History Modal State
  const [selectedCron, setSelectedCron] = React.useState<ApiCronJob | null>(
    null
  )
  const [runs, setRuns] = React.useState<ApiCronRun[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = React.useState(false)
  const [runningJobId, setRunningJobId] = React.useState<string | null>(null)

  const loadCrons = React.useCallback(async () => {
    try {
      const data = await apiGet<ApiCronJob[]>(`/services/${service.id}/crons`)
      setCrons(data || [])
      setErrorMessage(null)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load cron jobs"
      setErrorMessage(msg)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [service.id])

  React.useEffect(() => {
    let active = true
    apiGet<ApiCronJob[]>(`/services/${service.id}/crons`)
      .then((data) => {
        if (active) {
          setCrons(data || [])
          setIsLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg =
            err instanceof Error ? err.message : "Failed to load cron jobs"
          setErrorMessage(msg)
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [service.id])

  const handleRefresh = () => {
    setIsRefreshing(true)
    void loadCrons()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim() || !createSchedule.trim() || !createCommand.trim())
      return

    setIsSubmitting(true)
    try {
      await apiPost(`/services/${service.id}/crons`, {
        name: createName.trim(),
        schedule: createSchedule.trim(),
        command: createCommand.trim(),
      })
      setIsCreateOpen(false)
      setCreateName("")
      setCreateSchedule("0 * * * *")
      setCreateCommand("")
      void loadCrons()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create cron job")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (cron: ApiCronJob) => {
    const nextStatus = cron.status === "active" ? "paused" : "active"
    try {
      await apiPatch(`/services/${service.id}/crons/${cron.id}`, {
        status: nextStatus,
      })
      void loadCrons()
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to update cron job status"
      )
    }
  }

  const handleDelete = async (cron: ApiCronJob) => {
    if (!confirm(`Are you sure you want to delete cron job "${cron.name}"?`))
      return
    try {
      await apiDelete(`/services/${service.id}/crons/${cron.id}`)
      void loadCrons()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete cron job")
    }
  }

  const handleRunNow = async (cron: ApiCronJob) => {
    setRunningJobId(cron.id)
    try {
      await apiPost(`/services/${service.id}/crons/${cron.id}/run`)
      void loadCrons()
      if (selectedCron?.id === cron.id) {
        void viewHistory(cron)
      }
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to trigger cron job run"
      )
    } finally {
      setRunningJobId(null)
    }
  }

  const viewHistory = async (cron: ApiCronJob) => {
    setSelectedCron(cron)
    setIsLoadingRuns(true)
    try {
      const data = await apiGet<ApiCronRun[]>(
        `/services/${service.id}/crons/${cron.id}/runs`
      )
      setRuns(data || [])
    } catch (err: unknown) {
      console.error("Failed to load runs:", err)
      setRuns([])
    } finally {
      setIsLoadingRuns(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Scheduled Cron Jobs
          </h2>
          <p className="text-xs text-muted-foreground">
            Execute recurring tasks, maintenance scripts, and worker commands
            inside service containers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RotateCw
              className={cn("size-3.5", isRefreshing && "animate-spin")}
            />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            <span>New Cron Job</span>
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Crons List */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RotateCw className="size-4 animate-spin text-primary" />
            <span>Loading scheduled tasks...</span>
          </div>
        </div>
      ) : crons.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No cron jobs configured"
          description="Create recurring cron tasks to run background jobs, database syncs, or report generators inside your service container."
          actionLabel="Create First Cron Job"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Task Name</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Command</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Run</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {crons.map((cron) => {
                  const isActive = cron.status === "active"
                  const isRunning = runningJobId === cron.id

                  return (
                    <tr
                      key={cron.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="size-3.5 shrink-0 text-primary" />
                          <span>{cron.name}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="rounded bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-foreground">
                          {cron.schedule}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="block max-w-xs truncate font-mono text-[11px] text-muted-foreground">
                          {cron.command}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                            isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              isActive
                                ? "bg-emerald-500"
                                : "bg-muted-foreground"
                            )}
                          />
                          {cron.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-muted-foreground">
                        {cron.lastRunAt ? (
                          <div className="flex items-center gap-1.5">
                            {cron.lastStatus === "success" ? (
                              <CheckCircle2 className="size-3 text-emerald-500" />
                            ) : cron.lastStatus === "failed" ? (
                              <XCircle className="size-3 text-destructive" />
                            ) : (
                              <Clock className="size-3 text-amber-500" />
                            )}
                            <span>
                              {new Date(cron.lastRunAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">
                            Never
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRunNow(cron)}
                            disabled={isRunning}
                            className="h-7 px-2 text-xs text-primary hover:text-primary"
                            title="Run Now"
                            aria-label="Run cron job now"
                          >
                            <Play
                              className={cn(
                                "size-3",
                                isRunning && "animate-spin"
                              )}
                            />
                            <span className="ml-1 hidden sm:inline">Run</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(cron)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            title={
                              isActive ? "Pause schedule" : "Resume schedule"
                            }
                            aria-label={
                              isActive ? "Pause schedule" : "Resume schedule"
                            }
                          >
                            {isActive ? (
                              <Pause className="size-3 text-amber-500" />
                            ) : (
                              <Play className="size-3 text-emerald-500" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewHistory(cron)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            title="Execution Logs"
                            aria-label="View execution history"
                          >
                            <Terminal className="size-3" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cron)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                            title="Delete"
                            aria-label="Delete cron job"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Cron Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Scheduled Cron Job</DialogTitle>
            <DialogDescription>
              Configure recurring execution inside container {service.slug}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cron-name" className="text-xs">
                Job Name
              </Label>
              <Input
                id="cron-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Daily Cache Purge"
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cron-schedule" className="text-xs">
                  Cron Expression
                </Label>
                <div className="flex gap-1">
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setCreateSchedule(p.value)}
                      className="rounded border border-border/80 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                id="cron-schedule"
                value={createSchedule}
                onChange={(e) => setCreateSchedule(e.target.value)}
                placeholder="*/15 * * * *"
                className="font-mono text-xs"
                required
              />
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <HelpCircle className="size-3" />
                Format: minute hour day month day-of-week (UTC)
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cron-command" className="text-xs">
                Command / Script
              </Label>
              <Input
                id="cron-command"
                value={createCommand}
                onChange={(e) => setCreateCommand(e.target.value)}
                placeholder="e.g. /app/server --sync"
                className="font-mono text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs"
              >
                {isSubmitting ? "Creating..." : "Create Cron Job"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Run History & Logs Modal */}
      <Dialog
        open={!!selectedCron}
        onOpenChange={(open) => !open && setSelectedCron(null)}
      >
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="size-4 text-primary" />
              <span>Execution History: {selectedCron?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Schedule:{" "}
              <code className="font-mono text-xs">
                {selectedCron?.schedule}
              </code>{" "}
              • Command:{" "}
              <code className="font-mono text-xs">{selectedCron?.command}</code>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto py-2 pr-1">
            {isLoadingRuns ? (
              <div className="flex h-36 items-center justify-center">
                <RotateCw className="size-4 animate-spin text-primary" />
              </div>
            ) : runs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No runs recorded yet. Click &apos;Run Now&apos; to trigger
                execution.
              </div>
            ) : (
              runs.map((r) => (
                <div
                  key={r.id}
                  className="space-y-2 rounded-md border border-border bg-muted/20 p-3 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2">
                      {r.status === "success" ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="size-3.5 text-destructive" />
                      )}
                      <span className="font-semibold text-foreground capitalize">
                        {r.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        (exit code: {r.exitCode})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{new Date(r.startedAt).toLocaleString()}</span>
                      <span>{r.durationMs}ms</span>
                    </div>
                  </div>

                  {r.output && (
                    <pre className="overflow-x-auto rounded bg-zinc-950 p-2 font-mono text-[11px] text-zinc-300">
                      {r.output}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedCron(null)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
