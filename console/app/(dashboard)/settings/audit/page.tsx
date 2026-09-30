"use client"

import * as React from "react"
import Link from "next/link"
import { SettingsHeader } from "@/components/settings-header"
import {
  ScrollIcon,
  ArrowClockwiseIcon,
  CircleNotchIcon,
  ClockCounterClockwiseIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorCard } from "@/components/states/error-card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { useApi, ApiError, type AuditLogEntry } from "@/lib/api"
import { cn } from "@/lib/utils"

function parseMetadata(meta: unknown): Record<string, any> | null {
  if (!meta) return null
  if (typeof meta === "object") return meta as Record<string, any>
  if (typeof meta === "string") {
    try {
      return JSON.parse(meta)
    } catch {
      return null
    }
  }
  return null
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.round((date.getTime() - now.getTime()) / 1000)

    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
    const absSeconds = Math.abs(diffInSeconds)

    if (absSeconds < 60) {
      return rtf.format(diffInSeconds, "second")
    }
    const diffInMinutes = Math.round(diffInSeconds / 60)
    if (Math.abs(diffInMinutes) < 60) {
      return rtf.format(diffInMinutes, "minute")
    }
    const diffInHours = Math.round(diffInMinutes / 60)
    if (Math.abs(diffInHours) < 24) {
      return rtf.format(diffInHours, "hour")
    }
    const diffInDays = Math.round(diffInHours / 24)
    if (Math.abs(diffInDays) < 30) {
      return rtf.format(diffInDays, "day")
    }
    const diffInMonths = Math.round(diffInDays / 30)
    if (Math.abs(diffInMonths) < 12) {
      return rtf.format(diffInMonths, "month")
    }
    const diffInYears = Math.round(diffInDays / 365)
    return rtf.format(diffInYears, "year")
  } catch {
    return dateString
  }
}

function formatAbsoluteTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d+Z$/, " UTC")
  } catch {
    return dateString
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

function getResourceBadge(resourceType?: string | null) {
  const type = resourceType?.toLowerCase() || ""

  switch (type) {
    case "service":
      return {
        badgeClass:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        label: "service",
      }
    case "server":
      return {
        badgeClass:
          "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        label: "server",
      }
    case "project":
      return {
        badgeClass:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        label: "project",
      }
    case "deployment":
      return {
        badgeClass:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        label: "deployment",
      }
    case "domain":
      return {
        badgeClass:
          "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
        label: "domain",
      }
    case "session":
      return {
        badgeClass:
          "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
        label: "session",
      }
    default:
      return {
        badgeClass: "bg-muted text-muted-foreground border-border",
        label: type || "system",
      }
  }
}

function AuditDescription({ entry }: { entry: AuditLogEntry }) {
  const meta = parseMetadata(entry.metadata)
  const action = entry.action
  const resourceId = entry.resource_id
  const resourceType = entry.resource_type?.toLowerCase() || ""

  const isDeleted = action.endsWith(".delete") || action.endsWith(".remove")

  const renderResourceLink = (href: string, label: string) => {
    if (isDeleted) {
      return (
        <span className="font-mono text-xs font-semibold text-foreground/80">
          {label}
        </span>
      )
    }
    return (
      <Link
        href={href}
        className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold text-foreground underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground"
      >
        {label}
        <ArrowUpRightIcon className="size-3 text-muted-foreground" />
      </Link>
    )
  }

  // Project actions
  if (action === "project.create") {
    return (
      <span>
        Created project{" "}
        {resourceId
          ? renderResourceLink(`/projects/${resourceId}`, resourceId)
          : "unknown"}
      </span>
    )
  }
  if (action === "project.update") {
    return (
      <span>
        Updated project{" "}
        {resourceId
          ? renderResourceLink(`/projects/${resourceId}`, resourceId)
          : "unknown"}
      </span>
    )
  }
  if (action === "project.delete") {
    return (
      <span>
        Deleted project{" "}
        <span className="font-mono text-xs">{resourceId || "unknown"}</span>
      </span>
    )
  }

  // Service actions
  if (action === "service.deploy") {
    const serviceHref =
      meta?.project_id && resourceId
        ? `/projects/${meta.project_id}/services/${resourceId}`
        : resourceId
          ? `/projects`
          : `/projects`
    const commitSha = meta?.commit_sha
      ? String(meta.commit_sha).slice(0, 7)
      : null
    const branch = meta?.branch ? String(meta.branch) : null
    return (
      <span>
        Deployed service{" "}
        {resourceId ? renderResourceLink(serviceHref, resourceId) : "unknown"}
        {commitSha || branch ? (
          <span className="text-muted-foreground">
            {" "}
            ({commitSha ? `commit ${commitSha}` : ""}
            {commitSha && branch ? `, branch ` : branch ? `branch ` : ""}
            {branch ? (
              <code className="font-mono text-xs">{branch}</code>
            ) : null}
            )
          </span>
        ) : null}
      </span>
    )
  }
  if (action === "service.rollback") {
    const serviceHref =
      meta?.project_id && resourceId
        ? `/projects/${meta.project_id}/services/${resourceId}`
        : `/projects`
    const targetDep = meta?.target_deployment_id
      ? String(meta.target_deployment_id).slice(0, 8)
      : null
    return (
      <span>
        Rolled back service{" "}
        {resourceId ? renderResourceLink(serviceHref, resourceId) : "unknown"}
        {targetDep ? (
          <span className="text-muted-foreground">
            {" "}
            to deployment <code className="font-mono text-xs">{targetDep}</code>
          </span>
        ) : null}
      </span>
    )
  }
  if (action === "service.create") {
    const serviceHref =
      meta?.project_id && resourceId
        ? `/projects/${meta.project_id}/services/${resourceId}`
        : `/projects`
    return (
      <span>
        Created service{" "}
        {resourceId ? renderResourceLink(serviceHref, resourceId) : "unknown"}
      </span>
    )
  }
  if (action === "service.update") {
    const serviceHref =
      meta?.project_id && resourceId
        ? `/projects/${meta.project_id}/services/${resourceId}`
        : `/projects`
    return (
      <span>
        Updated service{" "}
        {resourceId ? renderResourceLink(serviceHref, resourceId) : "unknown"}
      </span>
    )
  }
  if (action === "service.delete") {
    return (
      <span>
        Deleted service{" "}
        <span className="font-mono text-xs">{resourceId || "unknown"}</span>
      </span>
    )
  }

  // Server actions
  if (action === "server.add") {
    return (
      <span>
        Added server{" "}
        {resourceId
          ? renderResourceLink(`/servers/${resourceId}`, resourceId)
          : "unknown"}
      </span>
    )
  }
  if (action === "server.update") {
    return (
      <span>
        Updated server{" "}
        {resourceId
          ? renderResourceLink(`/servers/${resourceId}`, resourceId)
          : "unknown"}
      </span>
    )
  }
  if (action === "server.delete") {
    return (
      <span>
        Deleted server{" "}
        <span className="font-mono text-xs">{resourceId || "unknown"}</span>
      </span>
    )
  }
  if (action === "server.prune") {
    const reclaimed =
      typeof meta?.reclaimed_bytes === "number"
        ? formatBytes(meta.reclaimed_bytes)
        : null
    return (
      <span>
        Pruned unused Docker resources on server{" "}
        {resourceId
          ? renderResourceLink(`/servers/${resourceId}`, resourceId)
          : "unknown"}
        {reclaimed ? (
          <span className="text-muted-foreground">
            {" "}
            ({reclaimed} reclaimed)
          </span>
        ) : null}
      </span>
    )
  }

  // Environment variables
  if (action === "env.update") {
    const targetHref =
      resourceType === "server" && resourceId
        ? `/servers/${resourceId}`
        : meta?.project_id && resourceId
          ? `/projects/${meta.project_id}/services/${resourceId}`
          : `/projects`
    const count = meta?.total_count ?? meta?.env_vars_count ?? null
    return (
      <span>
        Updated environment variables for {resourceType || "resource"}{" "}
        {resourceId ? renderResourceLink(targetHref, resourceId) : "unknown"}
        {count !== null ? (
          <span className="text-muted-foreground">
            {" "}
            ({count} variables updated)
          </span>
        ) : null}
      </span>
    )
  }

  // Domain actions
  if (action === "domain.add") {
    const domainName = meta?.domain || resourceId || "unknown"
    return (
      <span>
        Added domain{" "}
        <code className="font-mono text-xs font-semibold">{domainName}</code>
      </span>
    )
  }
  if (action === "domain.remove") {
    const domainName = meta?.domain || resourceId || "unknown"
    return (
      <span>
        Removed domain <code className="font-mono text-xs">{domainName}</code>
      </span>
    )
  }

  // Session actions
  if (action === "session.login") {
    const method = meta?.method ? String(meta.method) : "credentials"
    return <span>Administrator signed in via {method}</span>
  }
  if (action === "session.logout") {
    return <span>Administrator signed out</span>
  }

  // Generic fallback
  return (
    <span>
      {action.replace(".", " ")}{" "}
      {resourceId ? (
        <span className="font-mono text-xs text-foreground/80">
          ({resourceId})
        </span>
      ) : null}
    </span>
  )
}

export default function AuditSettingsPage() {
  const api = useApi()

  const [entries, setEntries] = React.useState<AuditLogEntry[]>([])
  const [nextCursor, setNextCursor] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<Error | ApiError | string | null>(
    null
  )

  const fetchInitial = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.auditLog.list({ limit: 50 })
      setEntries(res.items || [])
      setNextCursor(res.next_cursor || null)
    } catch (err) {
      if (err instanceof ApiError || err instanceof Error) {
        setError(err)
      } else {
        setError("Failed to load audit activity feed.")
      }
    } finally {
      setLoading(false)
    }
  }, [api])

  const loadMore = React.useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await api.auditLog.list({ limit: 50, before: nextCursor })
      setEntries((prev) => [...prev, ...(res.items || [])])
      setNextCursor(res.next_cursor || null)
    } catch (err) {
      console.error("Failed to fetch older audit logs:", err)
    } finally {
      setLoadingMore(false)
    }
  }, [api, nextCursor, loadingMore])

  React.useEffect(() => {
    fetchInitial()
  }, [fetchInitial])

  return (
    <TooltipProvider>
      <div className="flex w-full flex-col gap-6 md:gap-8">
        <SettingsHeader
          title="Audit Log"
          description="Audit trail of administrative actions, resource mutations, and system access events."
          action={
            <Button
              variant="outline"
              onClick={fetchInitial}
              disabled={loading}
              className="gap-2 text-sm font-medium"
            >
              <ArrowClockwiseIcon
                className={cn("size-4", loading && "animate-spin")}
              />
              <span>Refresh Feed</span>
            </Button>
          }
        />

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-center gap-3">
                  <Skeleton className="h-4 w-20 shrink-0" />
                  <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
                  <Skeleton className="h-4 w-64 flex-1" />
                </div>
                <Skeleton className="h-4 w-24 shrink-0" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorCard
            title="Failed to load audit activity"
            error={error}
            onRetry={fetchInitial}
            retryLabel="Retry"
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<ScrollIcon className="size-6 text-foreground" />}
            title="No audit activity recorded"
            description="Actions like deployments, server management, and environment variable updates will be logged here."
            action={{
              label: "Refresh feed",
              onClick: fetchInitial,
            }}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {entries.map((entry) => {
                const badge = getResourceBadge(entry.resource_type)
                const relativeTime = formatRelativeTime(entry.created_at)
                const absoluteTime = formatAbsoluteTime(entry.created_at)
                const ipText =
                  entry.ip_address && entry.ip_address.trim() !== ""
                    ? entry.ip_address
                    : "local"

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center"
                  >
                    {/* Timestamp, Badge, and Action Description */}
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                      {/* Relative time with tooltip */}
                      <Tooltip>
                        <TooltipTrigger
                          type="button"
                          className="w-24 shrink-0 cursor-default text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                          title={absoluteTime}
                        >
                          <time dateTime={entry.created_at}>
                            {relativeTime}
                          </time>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {absoluteTime}
                        </TooltipContent>
                      </Tooltip>

                      {/* Resource Type Badge */}
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium tracking-tight",
                          badge.badgeClass
                        )}
                      >
                        {badge.label}
                      </span>

                      {/* Action & Resource Link Description */}
                      <div className="min-w-0 flex-1 text-sm text-foreground">
                        <AuditDescription entry={entry} />
                      </div>
                    </div>

                    {/* Monospace IP Address */}
                    <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                      <span
                        className="font-mono text-xs text-muted-foreground"
                        title={`Recorded by actor: ${entry.actor || "owner"}`}
                      >
                        {ipText}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {nextCursor ? (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full sm:w-auto"
                >
                  {loadingMore ? (
                    <>
                      <CircleNotchIcon className="mr-2 size-4 animate-spin" />
                      Loading older activity...
                    </>
                  ) : (
                    <>
                      <ClockCounterClockwiseIcon className="mr-2 size-4" />
                      Load older activity
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="py-2 text-center text-xs text-muted-foreground">
                End of audit history
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
