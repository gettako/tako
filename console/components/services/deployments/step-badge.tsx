"use client"

import * as React from "react"
import { AlertTriangle, Check, Loader2 } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DeploymentPipelineStep, DeploymentStepStatus } from "@/types/platform"
import { cn } from "@/lib/utils"

export interface StepBadgeProps {
  step: DeploymentPipelineStep
  isActive?: boolean
  onClick?: () => void
}

function formatTimestamp(isoOrStr?: string): string {
  if (!isoOrStr) return ""
  if (/^\d{2}:\d{2}:\d{2}/.test(isoOrStr)) {
    return isoOrStr
  }
  try {
    const d = new Date(isoOrStr)
    if (isNaN(d.getTime())) return isoOrStr
    const hours = String(d.getHours()).padStart(2, "0")
    const minutes = String(d.getMinutes()).padStart(2, "0")
    const seconds = String(d.getSeconds()).padStart(2, "0")
    const ms = String(d.getMilliseconds()).padStart(3, "0")
    return `${hours}:${minutes}:${seconds}.${ms}`
  } catch {
    return isoOrStr
  }
}

export function StepBadge({ step, isActive = false, onClick }: StepBadgeProps) {
  const durationText =
    step.duration ||
    (step.durationMs ? `${Math.round(step.durationMs / 1000)}s` : null)
  const timeFormatted = formatTimestamp(step.startedAt)

  const getStatusIcon = (status: DeploymentStepStatus) => {
    switch (status) {
      case "success":
        return (
          <div className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
            <Check className="size-2.5 stroke-[3]" />
          </div>
        )
      case "running":
        return (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
        )
      case "failed":
        return (
          <div className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-xs">
            <AlertTriangle className="size-2.5 stroke-[2.5]" />
          </div>
        )
      default:
        return null
    }
  }

  const label = `Inspect step ${step.name}: ${step.status}${durationText ? `, ${durationText}` : ""}`

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {/* 1. Top: Stage Name */}
      <span
        className="truncate text-xs font-normal text-muted-foreground select-none"
        title={step.name}
      >
        {step.name}
      </span>

      {/* 2. Middle: Progress Capsule Bar */}
      <TooltipProvider delay={150}>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onClick}
                aria-label={label}
                className={cn(
                  "relative flex h-7 w-full items-center justify-end gap-1.5 overflow-hidden rounded-md border border-primary/15 bg-primary/5 px-2 text-right transition-all outline-none select-none focus-visible:ring-1 focus-visible:ring-primary sm:h-8",
                  step.status === "pending" || step.status === "skipped"
                    ? "cursor-default border-primary/10 bg-primary/[0.02] opacity-60"
                    : "cursor-pointer hover:border-primary/30 hover:bg-primary/10",
                  step.status === "running" &&
                    "border-primary/60 bg-primary/10 shadow-xs",
                  step.status === "failed" &&
                    "border-rose-500/60 bg-rose-500/5 shadow-xs",
                  isActive && "border-primary shadow-xs ring-1 ring-primary"
                )}
              />
            }
          >
            {/* Visual step progress fill if running */}
            {step.status === "running" && (
              <div
                className="absolute inset-y-0 left-0 w-3/5 animate-pulse bg-primary/15 transition-all"
                aria-hidden="true"
              />
            )}
            {step.status === "failed" && (
              <div
                className="absolute inset-y-0 left-0 w-full bg-rose-500/5 transition-all"
                aria-hidden="true"
              />
            )}

            {/* Content within bar */}
            <div className="relative z-10 flex items-center gap-1.5 font-mono text-[11px]">
              {durationText && (
                <span
                  className={cn(
                    "select-none",
                    step.status === "running"
                      ? "font-medium text-primary"
                      : step.status === "failed"
                        ? "font-medium text-rose-500"
                        : "text-muted-foreground"
                  )}
                >
                  {durationText}
                </span>
              )}
              {getStatusIcon(step.status)}
            </div>
          </TooltipTrigger>

          <TooltipContent
            side="top"
            className="space-y-0.5 px-2.5 py-1.5 text-[11px]"
          >
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">{step.name}</span>
              <span className="text-muted-foreground capitalize">
                : {step.status}
              </span>
              {durationText && (
                <span className="font-mono text-muted-foreground">
                  ({durationText})
                </span>
              )}
            </div>
            {step.description && (
              <p className="text-[10px] text-muted-foreground">
                {step.description}
              </p>
            )}
            {timeFormatted && (
              <p className="font-mono text-[10px] text-muted-foreground/80">
                Started: {timeFormatted}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* 3. Bottom: Timestamp */}
      <span
        className="min-h-[16px] truncate font-mono text-[11px] text-muted-foreground/70 select-none"
        title={timeFormatted}
      >
        {timeFormatted || ""}
      </span>
    </div>
  )
}
