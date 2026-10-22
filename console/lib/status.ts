import type { NodeStatus, ServiceStatus } from "@/types/platform"

export function activeStatusDotClass(isActive: boolean) {
  return isActive ? "animate-pulse bg-emerald-500" : "bg-destructive"
}

export function statusDotClass(status: NodeStatus | ServiceStatus) {
  switch (status) {
    case "online":
    case "running":
      return "bg-emerald-500"
    case "degraded":
    case "deploying":
      return "bg-amber-500"
    case "stopped":
      return "bg-muted-foreground"
    case "offline":
    case "failed":
      return "bg-destructive"
    default:
      return "bg-muted-foreground"
  }
}
