"use client"

import * as React from "react"
import { api, type ServiceDetail, type ServiceStatus } from "@/lib/api"

export interface ToastMessage {
  id: string
  type: "success" | "error"
  message: string
}

export interface ServiceContextValue {
  serviceId: string
  projectId: string
  service: ServiceDetail | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  updateServiceState: (patch: Partial<ServiceDetail>) => void
  showToast: (type: "success" | "error", message: string) => void
}

const ServiceContext = React.createContext<ServiceContextValue | null>(null)

export function useService(): ServiceContextValue {
  const context = React.useContext(ServiceContext)
  if (!context) {
    throw new Error("useService must be used within a ServiceProvider")
  }
  return context
}

export function ServiceProvider({
  serviceId,
  projectId,
  initialService,
  children,
}: {
  serviceId: string
  projectId: string
  initialService?: ServiceDetail | null
  children: React.ReactNode
}) {
  const [service, setService] = React.useState<ServiceDetail | null>(
    () => initialService || null
  )
  const [isLoading, setIsLoading] = React.useState(() => !initialService)
  const [error, setError] = React.useState<Error | null>(null)
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])

  const showToast = React.useCallback(
    (type: "success" | "error", message: string) => {
      const toastId = Math.random().toString(36).slice(2, 9)
      setToasts((prev) => [...prev, { id: toastId, type, message }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId))
      }, 3500)
    },
    []
  )

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const loadService = React.useCallback(async () => {
    if (!serviceId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.services.get(serviceId)
      setService(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to load service details.")
      )
    } finally {
      setIsLoading(false)
    }
  }, [serviceId])

  React.useEffect(() => {
    loadService()
  }, [loadService])

  // Live status transitions via SSE
  React.useEffect(() => {
    if (!serviceId) return
    let isSubscribed = true

    const stream = api.services.streamStatus(serviceId)
    ;(async () => {
      try {
        for await (const event of stream) {
          if (!isSubscribed) break
          if (event.status) {
            setService((prev) =>
              prev ? { ...prev, status: event.status as ServiceStatus } : null
            )
          }
        }
      } catch {
        // SSE connection failure ignored in background
      }
    })()

    return () => {
      isSubscribed = false
    }
  }, [serviceId])

  const updateServiceState = React.useCallback(
    (patch: Partial<ServiceDetail>) => {
      setService((prev) => (prev ? { ...prev, ...patch } : null))
    },
    []
  )

  const value = React.useMemo<ServiceContextValue>(
    () => ({
      serviceId,
      projectId,
      service,
      isLoading,
      error,
      refetch: loadService,
      updateServiceState,
      showToast,
    }),
    [
      serviceId,
      projectId,
      service,
      isLoading,
      error,
      loadService,
      updateServiceState,
      showToast,
    ]
  )

  return (
    <ServiceContext.Provider value={value}>
      {children}
      {/* Toast notifications container */}
      {toasts.length > 0 && (
        <div
          role="region"
          aria-label="Notifications"
          className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto flex max-w-sm items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-sm ${
                toast.type === "success"
                  ? "border-status-healthy-border bg-status-healthy-bg text-status-healthy-text"
                  : "border-status-failed-border bg-status-failed-bg text-status-failed-text"
              }`}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="cursor-pointer p-0.5 opacity-70 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </ServiceContext.Provider>
  )
}
