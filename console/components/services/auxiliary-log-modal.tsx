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
import { ArrowsClockwiseIcon } from "@phosphor-icons/react"
import { api, type Service, type ContainerLogEvent } from "@/lib/api"

export interface AuxiliaryLogPanelProps {
  service: Service
  onClose?: () => void
}

export function AuxiliaryLogPanel({
  service,
  onClose,
}: AuxiliaryLogPanelProps) {
  const [logs, setLogs] = React.useState<ContainerLogEvent[]>([])
  const [isConnecting, setIsConnecting] = React.useState(true)
  const [refreshKey, setRefreshKey] = React.useState(0)

  // Stream live logs when mounted
  React.useEffect(() => {
    if (!service.id) return

    let isActive = true
    setIsConnecting(true)
    setLogs([])

    const stream = api.services.streamContainerLogs(service.id, {
      tail: 500,
      follow: true,
    })

    ;(async () => {
      try {
        for await (const chunk of stream) {
          if (!isActive) break
          setIsConnecting(false)
          setLogs((prev) => [...prev, chunk])
        }
      } catch {
        // Stream aborted or connection completed
      } finally {
        if (isActive) {
          setIsConnecting(false)
        }
      }
    })()

    return () => {
      isActive = false
    }
  }, [service.id, refreshKey])

  const isWorker = service.service_type === "worker"
  const typeLabel = isWorker ? "Worker Process" : "Scheduled Cron"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-center justify-between border-b border-border pb-3">
        <DialogHeader className="gap-1 text-left">
          <div className="flex items-center gap-2">
            <DialogTitle className="font-mono text-lg">
              {service.name}
            </DialogTitle>
            <StatusBadge variant={service.status} />
            <span className="rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {typeLabel}
            </span>
          </div>
          <DialogDescription className="font-mono text-xs">
            Command: {service.command || "default"}
            {service.cron_expression &&
              ` | Schedule: ${service.cron_expression}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="gap-1.5 text-xs"
            title="Reconnect log stream"
          >
            <ArrowsClockwiseIcon className="size-3.5" aria-hidden="true" />
            Reconnect
          </Button>
        </div>
      </div>

      <div className="min-h-100 flex-1 overflow-hidden pt-1">
        <LogViewer
          logs={logs}
          isLoading={isConnecting}
          emptyMessage="No runtime container logs received yet."
          title="Container Output"
          className="h-115"
          showLineNumbers
          onClear={() => setLogs([])}
        />
      </div>
    </div>
  )
}

export interface AuxiliaryLogModalProps {
  service: Service | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuxiliaryLogModal({
  service,
  open,
  onOpenChange,
}: AuxiliaryLogModalProps) {
  if (!service) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="5xl" className="flex flex-col">
        <AuxiliaryLogPanel
          service={service}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
