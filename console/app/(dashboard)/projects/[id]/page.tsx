"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Plus,
  GearSix,
  ArrowSquareOut,
  GitBranch,
  HardDrives,
  ArrowClockwise,
  StopCircleIcon,
  PlayCircle,
  CircleNotchIcon,
  Check,
  Warning,
  X,
  Database,
  Lock,
  Trash,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorCard } from "@/components/states/error-card"
import { CreateServiceDialog } from "@/components/services/create-service-dialog"
import { DeleteServiceDialog } from "@/components/services/delete-service-dialog"
import { ProjectSettingsDialog } from "@/components/projects/project-settings-dialog"
import { api, type ProjectDetail, type Service, type Server } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ToastNotification {
  id: string
  type: "success" | "error"
  message: string
}

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>
}) {
  const router = useRouter()
  const [projectId, setProjectId] = React.useState<string>(() => {
    if (
      params &&
      typeof (params as Promise<{ id: string }>).then !== "function"
    ) {
      return (params as { id: string }).id
    }
    return ""
  })

  React.useEffect(() => {
    if (
      params &&
      typeof (params as Promise<{ id: string }>).then === "function"
    ) {
      Promise.resolve(params).then((resolved) => {
        setProjectId(resolved.id)
      })
    }
  }, [params])

  const [project, setProject] = React.useState<ProjectDetail | null>(null)
  const [services, setServices] = React.useState<Service[]>([])
  const [servers, setServers] = React.useState<Server[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  const [activeActions, setActiveActions] = React.useState<
    Record<string, string>
  >({})
  const [toasts, setToasts] = React.useState<ToastNotification[]>([])
  const [createServiceOpen, setCreateServiceOpen] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [serviceToDelete, setServiceToDelete] = React.useState<Service | null>(
    null
  )

  const showToast = React.useCallback(
    (type: "success" | "error", message: string) => {
      const toastId = Math.random().toString(36).slice(2, 9)
      setToasts((prev) => [...prev, { id: toastId, type, message }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId))
      }, 3500)
    },
    []
  )

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const loadData = React.useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    setError(null)
    try {
      const [projectData, servicesData, serversData] = await Promise.all([
        api.projects.get(projectId),
        api.services.list({ projectId }),
        api.servers.list(),
      ])
      setProject(projectData)
      setServices(servicesData)
      setServers(serversData)
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to load project details.")
      )
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // Live status stream via SSE for services in this project
  React.useEffect(() => {
    if (services.length === 0) return

    const abortControllers = services.map((service) => {
      const controller = new AbortController()

      ;(async () => {
        try {
          const stream = api.services.streamStatus(service.id)
          for await (const event of stream) {
            if (controller.signal.aborted) break
            setServices((prev) =>
              prev.map((s) =>
                s.id === event.service_id
                  ? {
                      ...s,
                      status: event.status as Service["status"],
                      active_deployment_id:
                        event.active_deployment_id ?? s.active_deployment_id,
                    }
                  : s
              )
            )
          }
        } catch {
          // SSE stream closed or error, silent recovery
        }
      })()

      return controller
    })

    return () => {
      abortControllers.forEach((c) => c.abort())
    }
  }, [services.length])

  // Map server IDs to server names
  const serverMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const s of servers) {
      map.set(s.id, s.name)
    }
    return map
  }, [servers])

  // Service mutation handlers
  const handleQuickAction = async (
    serviceId: string,
    action: "restart" | "stop" | "start" | "rebuild"
  ) => {
    setActiveActions((prev) => ({ ...prev, [serviceId]: action }))
    try {
      if (action === "restart") {
        const updated = await api.services.restart(serviceId)
        setServices((prev) =>
          prev.map((s) => (s.id === serviceId ? updated : s))
        )
        showToast(
          "success",
          `Service "${updated.name}" restarted successfully.`
        )
      } else if (action === "stop") {
        const updated = await api.services.stop(serviceId)
        setServices((prev) =>
          prev.map((s) => (s.id === serviceId ? updated : s))
        )
        showToast("success", `Service "${updated.name}" stopped.`)
      } else if (action === "start") {
        const updated = await api.services.start(serviceId)
        setServices((prev) =>
          prev.map((s) => (s.id === serviceId ? updated : s))
        )
        showToast("success", `Service "${updated.name}" started.`)
      } else if (action === "rebuild") {
        const deployment = await api.services.rebuild(serviceId)
        setServices((prev) =>
          prev.map((s) =>
            s.id === serviceId
              ? {
                  ...s,
                  status: "building",
                  active_deployment_id: deployment.id,
                }
              : s
          )
        )
        showToast(
          "success",
          `Rebuild triggered for service. Deployment ${deployment.id} queued.`
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed."
      showToast("error", msg)
    } finally {
      setActiveActions((prev) => {
        const next = { ...prev }
        delete next[serviceId]
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Toast Notification Container */}
      <div
        role="region"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-3 rounded-md border p-3 text-xs shadow-none transition-all duration-200",
              toast.type === "success"
                ? "border-emerald-500/30 bg-card text-foreground"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            )}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Warning className="size-4 text-destructive" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Back Link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back to Projects</span>
      </Link>

      {/* Loading & Error States */}
      {isLoading ? (
        <div className="flex flex-col gap-6">
          <LoadingSkeleton variant="block" />
          <LoadingSkeleton variant="table" rows={4} />
        </div>
      ) : error || !project ? (
        <ErrorCard
          error={error || new Error("Project not found.")}
          onRetry={loadData}
          title="Could not load project"
        />
      ) : (
        <>
          {/* Project Header */}
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 md:flex-row md:items-start md:justify-between">
            <div className="flex max-w-2xl flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {project.name}
                </h1>
                <span className="rounded border border-border bg-muted/30 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {project.id}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {project.description || "No project description provided."}
              </p>
              <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <HardDrives className="size-3.5" />
                  <span>
                    {services.length}{" "}
                    {services.length === 1 ? "service" : "services"}
                  </span>
                </span>
                <span>•</span>
                <span>
                  Target nodes:{" "}
                  {Array.from(new Set(services.map((s) => s.server_id)))
                    .map((sid) => serverMap.get(sid) || sid)
                    .join(", ") || "None"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <Button
                variant="outline"
                onClick={() => setSettingsOpen(true)}
                className="gap-2"
                aria-label="Project Settings"
              >
                <GearSix className="size-4" />
                <span>Settings</span>
              </Button>
              <Button
                onClick={() => setCreateServiceOpen(true)}
                className="gap-2"
                aria-label="Create New Service"
              >
                <Plus className="size-4" />
                <span>New Service</span>
              </Button>
            </div>
          </div>

          {/* Services Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Services
              </h2>
              <span className="text-xs text-muted-foreground">
                {services.length} total
              </span>
            </div>

            {services.length === 0 ? (
              <EmptyState
                icon={<HardDrives className="size-6 text-foreground" />}
                title="No services in this project"
                description="Deploy your first web application, API, or worker service to this project workspace."
                action={{
                  label: "Create Service",
                  onClick: () => setCreateServiceOpen(true),
                }}
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Service
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Server
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Domain
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Source
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {services.map((service) => {
                      const currentAction = activeActions[service.id]
                      const isActing = Boolean(currentAction)

                      return (
                        <tr
                          key={service.id}
                          className="group transition-colors hover:bg-muted/40"
                        >
                          {/* Service Name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {service.service_type === "database" ? (
                                <Database
                                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                                  aria-label="Database Service"
                                />
                              ) : null}
                              <Link
                                href={`/projects/${project.id}/services/${service.id}`}
                                className="rounded font-medium text-foreground hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                              >
                                {service.name}
                              </Link>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusBadge variant={service.status} />
                          </td>

                          {/* Server Node */}
                          <td className="px-4 py-3">
                            <span className="rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                              {serverMap.get(service.server_id) ||
                                service.server_id}
                            </span>
                          </td>

                          {/* Primary Domain */}
                          <td className="px-4 py-3">
                            {service.service_type === "database" ? (
                              <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                                <Lock className="size-3 text-muted-foreground" />
                                <span>
                                  tako_network:{service.internal_port || 5432}
                                </span>
                              </span>
                            ) : service.primary_domain ? (
                              <a
                                href={`https://${service.primary_domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-xs text-foreground hover:underline"
                              >
                                <span>{service.primary_domain}</span>
                                <ArrowSquareOut className="size-3 text-muted-foreground" />
                              </a>
                            ) : (
                              <span className="font-mono text-xs text-muted-foreground">
                                None
                              </span>
                            )}
                          </td>

                          {/* Source / Engine */}
                          <td className="px-4 py-3">
                            {service.service_type === "database" ? (
                              <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                                <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-3xs font-semibold text-foreground uppercase">
                                  {service.database_engine || "DB"}
                                </span>
                                <span className="max-w-32.5 truncate">
                                  {service.database_version || "latest"}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                                <GitBranch className="size-3.5 shrink-0" />
                                <span className="max-w-32.5 truncate">
                                  {service.branch}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Quick Actions Menu */}
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              {/* Rebuild (only for git-backed application services) */}
                              {service.service_type !== "database" && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={isActing}
                                  onClick={() =>
                                    handleQuickAction(service.id, "rebuild")
                                  }
                                  title="Redeploy service from git"
                                  aria-label={`Redeploy ${service.name}`}
                                >
                                  {currentAction === "rebuild" ? (
                                    <CircleNotchIcon className="size-3.5 animate-spin" />
                                  ) : (
                                    <ArrowClockwise className="size-3.5" />
                                  )}
                                </Button>
                              )}

                              {/* Stop or Start */}
                              {service.status === "stopped" ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={isActing}
                                  onClick={() =>
                                    handleQuickAction(service.id, "start")
                                  }
                                  title="Start service container"
                                  aria-label={`Start ${service.name}`}
                                >
                                  {currentAction === "start" ? (
                                    <CircleNotchIcon className="size-3.5 animate-spin" />
                                  ) : (
                                    <PlayCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={isActing}
                                  onClick={() =>
                                    handleQuickAction(service.id, "stop")
                                  }
                                  title="Stop service container"
                                  aria-label={`Stop ${service.name}`}
                                >
                                  {currentAction === "stop" ? (
                                    <CircleNotchIcon className="size-3.5 animate-spin" />
                                  ) : (
                                    <StopCircleIcon className="size-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                              )}

                              {/* Delete Service */}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={isActing}
                                onClick={() => setServiceToDelete(service)}
                                title="Delete service"
                                aria-label={`Delete ${service.name}`}
                                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dialogs */}
          <CreateServiceDialog
            open={createServiceOpen}
            onOpenChange={setCreateServiceOpen}
            projectId={project.id}
            onServiceCreated={() => {
              loadData()
            }}
          />

          {/* Project Settings Dialog */}
          <ProjectSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            project={project}
            onProjectUpdated={(updated) => {
              setProject((prev) => (prev ? { ...prev, ...updated } : null))
              loadData()
            }}
            onProjectDeleted={() => {
              router.push("/projects")
            }}
          />

          {/* Delete Service Dialog */}
          <DeleteServiceDialog
            open={Boolean(serviceToDelete)}
            onOpenChange={(open) => {
              if (!open) setServiceToDelete(null)
            }}
            service={serviceToDelete}
            onDeleted={() => {
              if (serviceToDelete) {
                showToast(
                  "success",
                  `Service "${serviceToDelete.name}" was deleted.`
                )
              }
              setServiceToDelete(null)
              loadData()
            }}
          />
        </>
      )}
    </div>
  )
}
