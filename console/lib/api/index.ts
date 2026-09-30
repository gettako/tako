import type { ApiClient } from "./client"
import { MockApiClient } from "./mock-client"
import { LiveApiClient } from "./live-client"

export * from "./client"
export * from "./mock-client"
export * from "./live-client"
export * from "./fixtures"

let clientInstance: ApiClient | null = null
let currentMode: string | undefined = undefined

export function resetApiClient(): void {
  clientInstance = null
  currentMode = undefined
}

export function getApiClient(explicitMode?: "mock" | "live"): ApiClient {
  const mode = explicitMode ?? process.env.NEXT_PUBLIC_API_MODE
  if (!clientInstance || currentMode !== mode) {
    currentMode = mode
    if (mode === "live") {
      clientInstance = new LiveApiClient()
    } else {
      clientInstance = new MockApiClient()
    }
  }
  return clientInstance
}

/**
 * Singleton API client instance governed by NEXT_PUBLIC_API_MODE=mock|live.
 */
export const api: ApiClient = new Proxy({} as ApiClient, {
  get(_target, prop: keyof ApiClient) {
    const client = getApiClient()
    return client[prop]
  },
})

/**
 * React hook to retrieve the active API client.
 */
export function useApi(): ApiClient {
  return getApiClient()
}
