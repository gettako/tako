import { apiGet, apiPatch, type ApiService } from "@/lib/api"
import { adaptService } from "@/lib/adapters"
import type { EnvVariable } from "@/types/platform"

export interface SaveEnvVarItem {
  key: string
  value: string
  isSecret?: boolean
}

export async function getServiceEnvVars(
  serviceId: string
): Promise<EnvVariable[]> {
  const data = await apiGet<ApiService>(`/services/${serviceId}`)
  const adapted = adaptService(data)
  return adapted.envVars || []
}

export async function updateServiceEnvVars(
  serviceId: string,
  envVars: SaveEnvVarItem[]
): Promise<EnvVariable[]> {
  const data = await apiPatch<ApiService>(`/services/${serviceId}`, {
    envVars,
  })
  const adapted = adaptService(data)
  return adapted.envVars || []
}

export function parseRawEnv(raw: string): SaveEnvVarItem[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const eq = line.indexOf("=")
      if (eq === -1) {
        return { key: line, value: "", isSecret: false }
      }
      let val = line.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      return {
        key: line.slice(0, eq).trim(),
        value: val,
        isSecret: line.toLowerCase().includes("secret") || line.toLowerCase().includes("key") || line.toLowerCase().includes("token"),
      }
    })
    .filter((item) => item.key.length > 0)
}

export function formatRawEnv(envVars: Array<{ key: string; value: string }>): string {
  return envVars.map((e) => `${e.key}=${e.value}`).join("\n")
}
