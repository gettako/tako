"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { LogViewer } from "@/components/log-viewer"
import {
  GitCommitIcon,
  GitBranchIcon,
  ClockIcon,
  StopCircleIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react"
import {
  api,
  type Deployment,
  type BuildLogStreamEvent,
  type BuildLogEvent,
} from "@/lib/api"

export interface BuildLogModalProps {
  serviceId: string
  deployment: Deployment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeploymentUpdated?: (updated: Deployment) => void
}

export interface BuildLogPanelProps {
  serviceId: string
  deployment: Deployment
  onClose?: () => void
  onDeploymentUpdated?: (updated: Deployment) => void
}

export function BuildLogPanel({
  serviceId,
  deployment,
  onDeploymentUpdated,
}: BuildLogPanelProps) {
  const [logs, setLogs] = React.useState<BuildLogStreamEvent[]>([])
  const [currentStatus, setCurrentStatus] = React.useState<
    Deployment["status"]
  >(deployment.status)
  const [isCancelling, setIsCancelling] = React.useState(false)
  const [isConnecting, setIsConnecting] = React.useState(true)

  const onDeploymentUpdatedRef = React.useRef(onDeploymentUpdated)
  onDeploymentUpdatedRef.current = onDeploymentUpdated

  const deploymentRef = React.useRef(deployment)
  deploymentRef.current = deployment

  // Reset state when deployment changes
  React.useEffect(() => {
    setCurrentStatus(deployment.status)
    setLogs([])
    setIsConnecting(true)
  }, [deployment.id])

  // Stream live logs via SSE / async iterable
  React.useEffect(() => {
    let isActive = true
    const deploymentId = deployment.id

    const stream = api.services.streamBuildLogs(serviceId, deploymentId)

    ;(async () => {
      try {
        setIsConnecting(true)
        for await (const chunk of stream) {
          if (!isActive) break
          setIsConnecting(false)
          setLogs((prev) => [...prev, chunk])

          if (chunk.event === "build_complete") {
            const finalStatus: Deployment["status"] =
              chunk.status === "success" ? "success" : "failed"
            setCurrentStatus(finalStatus)
            if (onDeploymentUpdatedRef.current) {
              onDeploymentUpdatedRef.current({
                ...deploymentRef.current,
                status: finalStatus,
                duration_seconds: chunk.duration_seconds,
              })
            }
            break
          }
        }
      } catch {
        // Stream closed
      } finally {
        if (isActive) {
          setIsConnecting(false)
        }
      }
    })()

    return () => {
      isActive = false
    }
  }, [deployment.id, serviceId])

  const handleCancelBuild = async () => {
    setIsCancelling(true)
    try {
      const cancelled = await api.services.cancelDeployment(
        serviceId,
        deployment.id
      )
      setCurrentStatus("cancelled")
      const cancellationLog: BuildLogEvent = {
        event: "build_log",
        stream: "stderr",
        line: "Build cancelled by user.",
        timestamp: new Date().toISOString(),
      }
      setLogs((prev) => [...prev, cancellationLog])
      if (onDeploymentUpdated) {
        onDeploymentUpdated(cancelled)
      }
    } catch {
      // Cancellation failure handled silently
    } finally {
      setIsCancelling(false)
    }
  }

  const isCancellable =
    currentStatus === "building" || currentStatus === "queued"

  const commitSha = deployment.commit_sha
    ? deployment.commit_sha.slice(0, 7)
    : "latest"

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="border-b border-border pr-12 pb-4 sm:pr-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DialogHeader className="gap-1 text-left">
            <div className="flex items-center gap-2">
              <DialogTitle>Build Logs</DialogTitle>
              <StatusBadge variant={currentStatus} size="sm" />
            </div>
            <DialogDescription className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-mono">
                <GitCommitIcon
                  className="size-3 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{commitSha}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-mono">
                <GitBranchIcon
                  className="size-3 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{deployment.branch}</span>
              </span>
              {deployment.duration_seconds !== null &&
                deployment.duration_seconds !== undefined && (
                  <span className="inline-flex items-center gap-1 font-mono">
                    <ClockIcon
                      className="size-3 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span>{deployment.duration_seconds}s</span>
                  </span>
                )}
            </DialogDescription>
          </DialogHeader>

          {/* Cancel Build Action */}
          {isCancellable && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelBuild}
              disabled={isCancelling}
              className="cursor-pointer gap-1.5"
            >
              {isCancelling ? (
                <CircleNotchIcon
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <StopCircleIcon className="size-3.5" aria-hidden="true" />
              )}
              <span>Cancel Build</span>
            </Button>
          )}
        </div>
      </div>

      {/* Live Build Log Viewer */}
      <div className="flex max-h-[70vh] min-h-[440px] flex-1 flex-col overflow-hidden">
        <LogViewer
          logs={logs}
          isLoading={isConnecting && logs.length === 0}
          emptyMessage="Waiting for build stream connection..."
          title={`Build Output (${commitSha})`}
          className="h-full rounded-md border border-border"
        />
      </div>
    </div>
  )
}

export function BuildLogModal({
  serviceId,
  deployment,
  open,
  onOpenChange,
  onDeploymentUpdated,
}: BuildLogModalProps) {
  if (!deployment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="5xl" className="flex flex-col gap-4">
        <BuildLogPanel
          serviceId={serviceId}
          deployment={deployment}
          onClose={() => onOpenChange(false)}
          onDeploymentUpdated={onDeploymentUpdated}
        />
      </DialogContent>
    </Dialog>
  )
}
