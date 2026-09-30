"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  GitBranchIcon,
  ClockIcon,
  TerminalWindowIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { StatusBadge, type StatusVariant } from "@/components/status-badge"
import { useService } from "./service-context"
import { api, type Deployment } from "@/lib/api"
import { cn } from "@/lib/utils"

function formatElapsed(
  startedAt: string | null | undefined,
  createdAt?: string
): string {
  const time = startedAt || createdAt
  if (!time) return "0s"
  try {
    const startMs = new Date(time).getTime()
    if (isNaN(startMs)) return "0s"
    const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
    const minutes = Math.floor(elapsedSec / 60)
    const seconds = elapsedSec % 60
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  } catch {
    return "0s"
  }
}

function ElapsedTimer({
  startedAt,
  createdAt,
}: {
  startedAt?: string | null
  createdAt?: string
}) {
  const [elapsed, setElapsed] = React.useState(() =>
    formatElapsed(startedAt, createdAt)
  )

  React.useEffect(() => {
    setElapsed(formatElapsed(startedAt, createdAt))
    const interval = setInterval(() => {
      setElapsed(formatElapsed(startedAt, createdAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt, createdAt])

  return (
    <div
      className="inline-flex shrink-0 items-center gap-1.5 rounded border border-border bg-card px-2.5 py-1 font-mono text-xs text-muted-foreground select-none"
      aria-label={`Elapsed time: ${elapsed}`}
    >
      <ClockIcon
        className="size-3.5 animate-pulse text-status-building-text"
        aria-hidden="true"
      />
      <span>{elapsed}</span>
    </div>
  )
}

export function ActiveDeploymentBanner() {
  const router = useRouter()
  const { service, serviceId, projectId } = useService()

  const [activeDeployment, setActiveDeployment] =
    React.useState<Deployment | null>(() => service?.active_deployment || null)
  const [isVisible, setIsVisible] = React.useState(false)

  // Sync active deployment from service
  React.useEffect(() => {
    if (service?.active_deployment) {
      setActiveDeployment(service.active_deployment)
    }
  }, [service?.active_deployment])

  // If service status is building or queued, fetch deployment if missing
  React.useEffect(() => {
    if (!serviceId) return

    const isBuilding = service?.status === "building"

    if (isBuilding && !service?.active_deployment) {
      let isCancelled = false
      if (service?.active_deployment_id) {
        api.services
          .getDeployment(serviceId, service.active_deployment_id)
          .then((dep) => {
            if (!isCancelled) setActiveDeployment(dep)
          })
          .catch(() => {})
      } else {
        api.services
          .listDeployments(serviceId, { limit: 5 })
          .then((res) => {
            if (isCancelled) return
            const inProgress = res.items.find((d) =>
              ["queued", "building", "deploying"].includes(d.status)
            )
            if (inProgress) {
              setActiveDeployment(inProgress)
            }
          })
          .catch(() => {})
      }
      return () => {
        isCancelled = true
      }
    }
  }, [
    serviceId,
    service?.status,
    service?.active_deployment,
    service?.active_deployment_id,
  ])

  // Check if build is actively running and not in terminal state
  const isTerminalStatus = service?.status
    ? ["failed", "stopped", "running", "unhealthy"].includes(service.status)
    : false

  const isDeploymentActive =
    activeDeployment &&
    ["queued", "building", "deploying"].includes(activeDeployment.status)

  const isServiceActive = service?.status === "building" && !isTerminalStatus

  const shouldShow =
    (isServiceActive || isDeploymentActive) && !isTerminalStatus

  React.useEffect(() => {
    if (shouldShow) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [shouldShow])

  if (!isVisible && !shouldShow) {
    return null
  }

  const statusVariant: StatusVariant =
    (activeDeployment?.status as StatusVariant) ||
    (service?.status as StatusVariant) ||
    "building"

  const commitSha = activeDeployment?.commit_sha
    ? activeDeployment.commit_sha.slice(0, 7)
    : "latest"

  const branch = activeDeployment?.branch || service?.branch || "main"

  const commitMessage =
    activeDeployment?.commit_message || "Active build in progress"

  const handleViewBuildLog = () => {
    const deploymentId = activeDeployment?.id || "active"
    router.push(
      `/projects/${projectId}/services/${serviceId}/deployments?openLog=${deploymentId}`
    )
  }

  return (
    <aside
      aria-label="Active deployment banner"
      className={cn(
        "sticky top-0 z-20 w-full transition-all duration-300 ease-in-out",
        shouldShow
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      )}
    >
      <div className="flex flex-col justify-between gap-3 rounded-lg border border-status-building-border bg-status-building-bg p-3.5 text-foreground sm:flex-row sm:items-center sm:p-4">
        {/* Left: Status badge, commit sha, branch, message */}
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <StatusBadge variant={statusVariant} size="sm" />

          <span className="rounded border border-border bg-card px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
            {commitSha}
          </span>

          <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <GitBranchIcon className="size-3 shrink-0" aria-hidden="true" />
            <span className="max-w-[120px] truncate sm:max-w-[180px]">
              {branch}
            </span>
          </span>

          <span
            className="max-w-[200px] truncate text-sm font-medium text-foreground sm:max-w-xs md:max-w-md"
            title={commitMessage}
          >
            {commitMessage}
          </span>
        </div>

        {/* Right: Elapsed timer and View Build Log action */}
        <div className="flex shrink-0 items-center gap-2.5 self-end sm:self-auto">
          <ElapsedTimer
            startedAt={activeDeployment?.started_at}
            createdAt={activeDeployment?.created_at || service?.created_at}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleViewBuildLog}
            className="cursor-pointer gap-1.5 border-border bg-card text-foreground hover:bg-muted"
          >
            <TerminalWindowIcon
              className="size-3.5 text-status-building-text"
              aria-hidden="true"
            />
            <span>View Build Log</span>
          </Button>
        </div>
      </div>
    </aside>
  )
}
