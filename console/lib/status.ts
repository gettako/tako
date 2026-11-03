import {
  NODE_STATUS,
  SERVICE_STATUS,
  type NodeStatus,
  type ServiceStatus,
} from "@/types/platform"

export function activeStatusDotClass(isActive: boolean) {
  return isActive ? "animate-pulse bg-emerald-500" : "bg-destructive"
}

export function statusDotClass(status: NodeStatus | ServiceStatus) {
  switch (status) {
    case NODE_STATUS.ONLINE:
    case SERVICE_STATUS.RUNNING:
      return "bg-emerald-500"
    case NODE_STATUS.DEGRADED:
    case SERVICE_STATUS.DEPLOYING:
      return "bg-amber-500"
    case SERVICE_STATUS.STOPPED:
      return "bg-muted-foreground"
    case NODE_STATUS.OFFLINE:
    case SERVICE_STATUS.FAILED:
      return "bg-destructive"
    default:
      return "bg-muted-foreground"
  }
}
