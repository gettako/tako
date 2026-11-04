import { apiGet, apiPost, type ApiDeployment } from "@/lib/api"
import { adaptDeployment } from "@/lib/adapters"
import type { DeploymentLogEntry, DeploymentRecord } from "@/types/platform"

export async function getServiceDeployments(
  serviceId: string
): Promise<DeploymentRecord[]> {
  const data = await apiGet<ApiDeployment[]>(
    `/deployments?serviceId=${encodeURIComponent(serviceId)}`
  )
  return data.map(adaptDeployment)
}

export async function getDeployment(
  deploymentId: string
): Promise<DeploymentRecord> {
  const data = await apiGet<ApiDeployment>(`/deployments/${deploymentId}`)
  return adaptDeployment(data)
}

export async function triggerDeploy(
  serviceId: string
): Promise<{ deploymentId: string; status: string }> {
  return apiPost(`/services/${serviceId}/deploy`, {})
}

export async function triggerRollback(deploymentId: string): Promise<void> {
  await apiPost(`/deployments/${deploymentId}/rollback`, {})
}

export async function cancelDeploy(deploymentId: string): Promise<void> {
  await apiPost(`/deployments/${deploymentId}/cancel`, {})
}

export async function getDeploymentLogs(
  deploymentId: string
): Promise<DeploymentLogEntry[]> {
  if (!deploymentId) return []
  try {
    const text = await apiGet<string>(
      `/deployments/${deploymentId}/logs/history`
    )
    const lines = String(text)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    return lines.map((line, index): DeploymentLogEntry => {
      let timestamp = ""
      let step = "Log"
      let msg = line
      const match = line.match(
        /^\[(\d{2}:\d{2}:\d{2})\]\s+\[([^\]]+)\]\s+([\s\S]*)$/
      )
      if (match) {
        timestamp = match[1]
        step = match[2]
        msg = match[3]
      }
      return {
        id: `${deploymentId}-log-${index}`,
        timestamp,
        level: /error|failed/i.test(msg)
          ? "error"
          : step === "Live"
            ? "success"
            : "info",
        step,
        message: msg.trim(),
      }
    })
  } catch {
    return []
  }
}

export async function getServiceLogs(
  serviceId: string,
  container?: string,
  tail = 100
): Promise<string> {
  try {
    const query = new URLSearchParams()
    if (container) query.set("container", container)
    query.set("tail", String(tail))

    const res = await apiGet<{ logs: string }>(
      `/services/${serviceId}/logs?${query.toString()}`
    )
    return res.logs || ""
  } catch {
    return ""
  }
}

