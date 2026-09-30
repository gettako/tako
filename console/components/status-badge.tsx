import * as React from "react"
import { cn } from "@/lib/utils"

export type StatusVariant =
  | "running"
  | "healthy"
  | "online"
  | "success"
  | "building"
  | "deploying"
  | "failed"
  | "error"
  | "offline"
  | "cancelled"
  | "stopped"
  | "inactive"
  | "queued"
  | "pending"
  | "unhealthy"

export type StatusSize = "sm" | "md"

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: StatusVariant
  size?: StatusSize
  label?: string
  showDot?: boolean
}

type StatusCategory =
  "healthy" | "building" | "failed" | "stopped" | "queued" | "unhealthy"

function resolveCategory(variant: StatusVariant): StatusCategory {
  switch (variant) {
    case "running":
    case "healthy":
    case "online":
    case "success":
      return "healthy"
    case "building":
    case "deploying":
      return "building"
    case "failed":
    case "error":
    case "offline":
    case "cancelled":
      return "failed"
    case "stopped":
    case "inactive":
      return "stopped"
    case "queued":
    case "pending":
      return "queued"
    case "unhealthy":
      return "unhealthy"
  }
}

const categoryStyles: Record<StatusCategory, string> = {
  healthy:
    "bg-status-healthy-bg border-status-healthy-border text-status-healthy-text",
  building:
    "bg-status-building-bg border-status-building-border text-status-building-text",
  failed:
    "bg-status-failed-bg border-status-failed-border text-status-failed-text",
  stopped:
    "bg-status-stopped-bg border-status-stopped-border text-status-stopped-text",
  queued:
    "bg-status-queued-bg border-status-queued-border text-status-queued-text",
  unhealthy:
    "bg-status-unhealthy-bg border-status-unhealthy-border text-status-unhealthy-text",
}

const sizeStyles: Record<StatusSize, string> = {
  sm: "text-xs px-2 py-0.5 gap-1.5",
  md: "text-xs font-medium px-2.5 py-1 gap-2",
}

const defaultLabels: Record<StatusVariant, string> = {
  running: "Running",
  healthy: "Healthy",
  online: "Online",
  success: "Success",
  building: "Building",
  deploying: "Deploying",
  failed: "Failed",
  error: "Error",
  offline: "Offline",
  cancelled: "Cancelled",
  stopped: "Stopped",
  inactive: "Inactive",
  queued: "Queued",
  pending: "Pending",
  unhealthy: "Unhealthy",
}

export function StatusBadge({
  variant,
  size = "sm",
  label,
  showDot,
  className,
  ...props
}: StatusBadgeProps) {
  const category = resolveCategory(variant)
  const isBuilding = category === "building"
  const displayLabel = label ?? defaultLabels[variant]
  const shouldRenderDot = showDot ?? isBuilding

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center rounded-full border leading-none transition-colors",
        categoryStyles[category],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {shouldRenderDot && (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full bg-current",
            isBuilding && "animate-pulse"
          )}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  )
}
