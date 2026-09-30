"use client"

import * as React from "react"
import {
  Cpu,
  Clock,
  Plus,
  TerminalWindow,
  Play,
  Stop,
  ArrowsClockwiseIcon,
  Trash,
  CircleNotchIcon,
  Code,
  Info,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorCard } from "@/components/states/error-card"
import { useService } from "@/components/services/service-context"
import { AddAuxiliaryDialog } from "@/components/services/add-auxiliary-dialog"
import { AuxiliaryLogModal } from "@/components/services/auxiliary-log-modal"
import { api, type Service } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function ServiceAuxiliaryPage() {
  const { service, serviceId, showToast } = useService()

  const [auxServices, setAuxServices] = React.useState<Service[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [selectedLogService, setSelectedLogService] =
    React.useState<Service | null>(null)
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(
    null
  )

  const loadAuxServices = React.useCallback(async () => {
    if (!serviceId) return
    setIsLoading(true)
    setError(null)

    try {
      const data = await api.services.list({ parentServiceId: serviceId })
      setAuxServices(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to load auxiliary services.")
      )
    } finally {
      setIsLoading(false)
    }
  }, [serviceId])

  React.useEffect(() => {
    loadAuxServices()
  }, [loadAuxServices])

  const handleStart = async (s: Service) => {
    setActionInProgress(s.id)
    try {
      const updated = await api.services.start(s.id)
      setAuxServices((prev) =>
        prev.map((item) => (item.id === s.id ? updated : item))
      )
      showToast?.("success", `Service ${s.name} started`)
    } catch (err) {
      showToast?.(
        "error",
        err instanceof Error ? err.message : "Failed to start service"
      )
    } finally {
      setActionInProgress(null)
    }
  }

  const handleStop = async (s: Service) => {
    setActionInProgress(s.id)
    try {
      const updated = await api.services.stop(s.id)
      setAuxServices((prev) =>
        prev.map((item) => (item.id === s.id ? updated : item))
      )
      showToast?.("success", `Service ${s.name} stopped`)
    } catch (err) {
      showToast?.(
        "error",
        err instanceof Error ? err.message : "Failed to stop service"
      )
    } finally {
      setActionInProgress(null)
    }
  }

  const handleRestart = async (s: Service) => {
    setActionInProgress(s.id)
    try {
      const updated = await api.services.restart(s.id)
      setAuxServices((prev) =>
        prev.map((item) => (item.id === s.id ? updated : item))
      )
      showToast?.("success", `Service ${s.name} restarted`)
    } catch (err) {
      showToast?.(
        "error",
        err instanceof Error ? err.message : "Failed to restart service"
      )
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDelete = async (s: Service) => {
    if (
      !confirm(`Are you sure you want to remove auxiliary service "${s.name}"?`)
    ) {
      return
    }

    setActionInProgress(s.id)
    try {
      await api.services.delete(s.id)
      setAuxServices((prev) => prev.filter((item) => item.id !== s.id))
      showToast?.("success", `Service ${s.name} deleted`)
    } catch (err) {
      showToast?.(
        "error",
        err instanceof Error ? err.message : "Failed to delete service"
      )
    } finally {
      setActionInProgress(null)
    }
  }

  const workers = auxServices.filter((s) => s.service_type === "worker")
  const cronJobs = auxServices.filter((s) => s.service_type === "cron")

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Top Banner & Action */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Auxiliary Services
            </h2>
            <span className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {auxServices.length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Background workers and scheduled cron tasks sharing container images
            and environment variables.
          </p>
        </div>

        {service && (
          <Button onClick={() => setIsAddOpen(true)} className="shrink-0 gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Add Auxiliary Service
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      ) : error ? (
        <ErrorCard error={error} onRetry={loadAuxServices} />
      ) : auxServices.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No Auxiliary Services"
          description="You have not configured any background workers or scheduled cron tasks for this service yet."
          action={{
            label: "Add Auxiliary Service",
            onClick: () => setIsAddOpen(true),
          }}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {/* Workers Section */}
          {workers.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Cpu className="size-5 text-primary" aria-hidden="true" />
                <h3 className="text-base font-semibold text-foreground">
                  Worker Processes ({workers.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {workers.map((worker) => {
                  const isBusy = actionInProgress === worker.id

                  return (
                    <div
                      key={worker.id}
                      className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20 md:flex-row md:items-center"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {worker.name}
                          </span>
                          <StatusBadge variant={worker.status} />
                          <span className="font-mono text-xs text-muted-foreground">
                            ID: {worker.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto rounded border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs text-foreground">
                          <Code
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            {worker.command || "No command set"}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLogService(worker)}
                          className="gap-1.5 text-xs"
                          title="View runtime logs"
                        >
                          <TerminalWindow
                            className="size-4"
                            aria-hidden="true"
                          />
                          Logs
                        </Button>

                        {worker.status === "running" ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => handleRestart(worker)}
                              className="gap-1.5 text-xs"
                              title="Restart worker"
                            >
                              {isBusy ? (
                                <CircleNotchIcon
                                  className="size-3.5 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ArrowsClockwiseIcon
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              )}
                              Restart
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => handleStop(worker)}
                              className="gap-1.5 text-xs text-destructive hover:text-destructive"
                              title="Stop worker"
                            >
                              <Stop className="size-3.5" aria-hidden="true" />
                              Stop
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handleStart(worker)}
                            className="gap-1.5 text-xs"
                            title="Start worker"
                          >
                            <Play className="size-3.5" aria-hidden="true" />
                            Start
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleDelete(worker)}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete worker"
                        >
                          <Trash className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Scheduled Cron Jobs Section */}
          {cronJobs.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-primary" aria-hidden="true" />
                <h3 className="text-base font-semibold text-foreground">
                  Scheduled Cron Jobs ({cronJobs.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {cronJobs.map((cron) => {
                  const isBusy = actionInProgress === cron.id

                  return (
                    <div
                      key={cron.id}
                      className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20 md:flex-row md:items-center"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {cron.name}
                          </span>
                          <StatusBadge variant={cron.status} />
                          <span className="rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                            Schedule: {cron.cron_expression || "* * * * *"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto rounded border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs text-foreground">
                          <Code
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            {cron.command || "No command set"}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLogService(cron)}
                          className="gap-1.5 text-xs"
                          title="View runtime logs"
                        >
                          <TerminalWindow
                            className="size-4"
                            aria-hidden="true"
                          />
                          Logs
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleRestart(cron)}
                          className="gap-1.5 text-xs"
                          title="Trigger run now"
                        >
                          {isBusy ? (
                            <CircleNotchIcon
                              className="size-3.5 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Play className="size-3.5" aria-hidden="true" />
                          )}
                          Run Now
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleDelete(cron)}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete cron job"
                        >
                          <Trash className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Dialog */}
      {service && (
        <AddAuxiliaryDialog
          parentService={service}
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          onSuccess={(newSvc) => {
            setAuxServices((prev) => [newSvc, ...prev])
            showToast?.("success", `Auxiliary service ${newSvc.name} created`)
          }}
        />
      )}

      {/* Log Stream Modal */}
      <AuxiliaryLogModal
        service={selectedLogService}
        open={Boolean(selectedLogService)}
        onOpenChange={(open) => {
          if (!open) setSelectedLogService(null)
        }}
      />
    </div>
  )
}
