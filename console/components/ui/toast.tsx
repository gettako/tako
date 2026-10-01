"use client"

import * as React from "react"
import {
  CheckCircleIcon,
  XCircleIcon,
  InfoIcon,
  XIcon,
} from "@phosphor-icons/react"
import { cn } from "cn"

export type ToastType = "default" | "success" | "error" | "info"

export interface ToastItem {
  id: string
  title?: string
  message: string
  type: ToastType
  duration?: number
}

type ToastListener = (toasts: ToastItem[]) => void

class ToastStore {
  private toasts: ToastItem[] = []
  private listeners: Set<ToastListener> = new Set()

  subscribe(listener: ToastListener) {
    this.listeners.add(listener)
    listener(this.toasts)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]))
  }

  add(toast: Omit<ToastItem, "id">): string {
    const id = Math.random().toString(36).slice(2, 9)
    const newToast: ToastItem = { ...toast, id }
    this.toasts = [...this.toasts, newToast]
    this.notify()

    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id)
      }, duration)
    }

    return id
  }

  remove(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id)
    this.notify()
  }

  getToasts(): ToastItem[] {
    return [...this.toasts]
  }

  clear() {
    this.toasts = []
    this.notify()
  }
}

const toastStore = new ToastStore()

export const toast = (
  message: string,
  options?: { title?: string; duration?: number }
) => {
  return toastStore.add({ message, type: "default", ...options })
}

toast.success = (
  message: string,
  options?: { title?: string; duration?: number }
) => {
  return toastStore.add({ message, type: "success", ...options })
}

toast.error = (
  message: string,
  options?: { title?: string; duration?: number }
) => {
  return toastStore.add({ message, type: "error", ...options })
}

toast.info = (
  message: string,
  options?: { title?: string; duration?: number }
) => {
  return toastStore.add({ message, type: "info", ...options })
}

toast.dismiss = (id: string) => {
  toastStore.remove(id)
}

toast.clear = () => {
  toastStore.clear()
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>(() =>
    toastStore.getToasts()
  )

  React.useEffect(() => {
    return toastStore.subscribe(setToasts)
  }, [])

  return {
    toasts,
    toast,
    dismiss: toastStore.remove.bind(toastStore),
  }
}

export function Toaster() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <aside
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-card p-3 text-card-foreground transition-all"
        >
          {item.type === "success" && (
            <CheckCircleIcon
              className="mt-0.5 size-4 shrink-0 text-emerald-500"
              aria-hidden="true"
            />
          )}
          {item.type === "error" && (
            <XCircleIcon
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
          )}
          {item.type === "info" && (
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
          )}

          <div className="flex flex-1 flex-col gap-0.5">
            {item.title && (
              <span className="text-xs font-semibold text-foreground">
                {item.title}
              </span>
            )}
            <span className="text-xs text-foreground/90">{item.message}</span>
          </div>

          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Dismiss notification"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </aside>
  )
}
