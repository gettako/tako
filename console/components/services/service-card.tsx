"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Boxes,
  FileCode2,
  GitCommit,
  Loader2,
  RotateCw,
  Server,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePlatformData } from "@/context/platform-data-context"
import { ProjectService } from "@/types/platform"
import { activeStatusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"

interface ServiceCardProps {
  service: ProjectService
  onDelete?: (id: string) => void
}

export function ServiceCard({ service, onDelete }: ServiceCardProps) {
  const { triggerDeploy, activeDeployingId } = usePlatformData()
  const isDeploying =
    activeDeployingId === service.id || service.status === "deploying"
  const isRunning = service.status === "running"

  const handleDeploy = (e: React.MouseEvent) => {
    e.stopPropagation()
    triggerDeploy(service.id)
  }

  const primaryPort = service.portMappings[0]
  const extraPortsCount =
    service.portMappings.length > 1 ? service.portMappings.length - 1 : 0
  const allPortsTooltip = service.portMappings
    .map((p) => `${p.host}:${p.container}`)
    .join(", ")

  return (
    <div className="group relative flex flex-col justify-between rounded-lg border border-border bg-card p-4.5 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm">
      <div className="min-w-0">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded border border-border bg-muted/40 text-foreground">
              {service.type === "dockerfile" ? (
                <FileCode2 className="size-4 text-primary" />
              ) : (
                <Boxes className="size-4 text-emerald-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/projects/${service.projectId}/services/${service.id}`}
                className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                title={service.name}
              >
                {service.name}
              </Link>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <span className="shrink-0 capitalize">
                  {service.type === "dockerfile" ? "Dockerfile" : "Compose"}
                </span>
                <span className="text-muted-foreground/60">•</span>
                <span
                  className="flex min-w-0 items-center gap-1 truncate"
                  title={service.targetNodeId}
                >
                  <Server className="size-3 shrink-0" />
                  <span className="truncate">{service.targetNodeId}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium transition-colors",
              isRunning
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : isDeploying
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {isDeploying ? (
              <Loader2 className="size-3 animate-spin text-primary" />
            ) : (
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  activeStatusDotClass(isRunning)
                )}
              />
            )}
            <span className="capitalize">
              {isDeploying ? "Deploying" : service.status}
            </span>
          </div>
        </div>

        {/* Description */}
        <p
          className="mt-2.5 line-clamp-1 text-xs text-muted-foreground"
          title={service.description}
        >
          {service.description}
        </p>

        {/* Port & Telemetry Metrics Strip */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 font-mono text-xs">
          {primaryPort ? (
            <div
              className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-foreground"
              title={allPortsTooltip}
            >
              <span>
                {primaryPort.host}:{primaryPort.container}
              </span>
              {extraPortsCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  +{extraPortsCount}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">No ports</span>
          )}

          <span className="text-muted-foreground/60">•</span>

          <span className="text-[11px] text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {service.metrics.memoryMb}
            </strong>{" "}
            MB RAM
          </span>

          <span className="text-muted-foreground/60">•</span>

          <span className="text-[11px] text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {service.metrics.cpuPercent}%
            </strong>{" "}
            CPU
          </span>
        </div>

        {/* Last Deployment Meta */}
        <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <GitCommit className="size-3 shrink-0 text-muted-foreground" />
          <span
            className="font-semibold text-foreground"
            title={service.lastDeployment.commitHash}
          >
            {service.lastDeployment.commitHash.slice(0, 8)}
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span className="truncate">{service.lastDeployment.startedAt}</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={isDeploying}
          onClick={handleDeploy}
          className="h-7 gap-1.5 text-xs"
        >
          {isDeploying ? (
            <>
              <Loader2 className="size-3 animate-spin text-primary" />
              <span>Deploying...</span>
            </>
          ) : (
            <>
              <RotateCw className="size-3 text-primary" />
              <span>Deploy</span>
            </>
          )}
        </Button>

        <div className="flex items-center gap-1">
          {onDelete && (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => onDelete(service.id)}
              className="size-7 text-muted-foreground hover:text-destructive"
              title="Delete service"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}

          <Link
            href={`/projects/${service.projectId}/services/${service.id}`}
            className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <span>Console</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
