"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

export interface UseKeyboardNavigationOptions {
  chordTimeout?: number
  dismissTimeout?: number
  onNavigate?: (path: string) => void
}

export interface UseKeyboardNavigationResult {
  isPending: boolean
  dismiss: () => void
}

export const DESTINATION_MAP: Record<string, string> = {
  d: "/",
  p: "/projects",
  s: "/servers",
  g: "/settings/github",
  a: "/settings/security",
}

export function isInputElement(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as {
    tagName?: string
    isContentEditable?: boolean
    getAttribute?: (attr: string) => string | null
  }
  const tagName = el.tagName ? el.tagName.toUpperCase() : ""
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true
  }
  return (
    Boolean(el.isContentEditable) ||
    Boolean(el.getAttribute && el.getAttribute("contenteditable") === "true")
  )
}

export function isDialogOpen(): boolean {
  if (typeof document === "undefined") return false
  return !!document.querySelector(
    '[role="dialog"], [role="alertdialog"], dialog[open]'
  )
}

export function useKeyboardNavigation({
  chordTimeout = 1000,
  dismissTimeout = 1500,
  onNavigate,
}: UseKeyboardNavigationOptions = {}): UseKeyboardNavigationResult {
  const router = useRouter()
  const [isPending, setIsPending] = React.useState(false)

  const chordTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const clearTimers = React.useCallback(() => {
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current)
      chordTimerRef.current = null
    }
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }, [])

  const dismiss = React.useCallback(() => {
    clearTimers()
    setIsPending(false)
  }, [clearTimers])

  React.useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never trigger when modifier keys are pressed
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }

      // Suppress when typing in inputs or when interactive dialog is open
      if (isInputElement(e.target) || isDialogOpen()) {
        if (isPending) {
          dismiss()
        }
        return
      }

      const key = e.key.toLowerCase()

      if (!isPending) {
        // Start chord if key is 'g'
        if (key === "g") {
          setIsPending(true)
          clearTimers()

          // Window during which second key can complete chord
          chordTimerRef.current = setTimeout(() => {
            // Chord window expired, user can no longer press second key
            chordTimerRef.current = null
          }, chordTimeout)

          // Auto-dismiss the visual hint popover
          dismissTimerRef.current = setTimeout(() => {
            setIsPending(false)
            dismissTimerRef.current = null
          }, dismissTimeout)
        }
        return
      }

      // Pending state: user pressed 'g' earlier
      if (e.key === "Escape") {
        e.preventDefault()
        dismiss()
        return
      }

      // If chord timer has not expired and key is recognized destination
      if (chordTimerRef.current && DESTINATION_MAP[key]) {
        e.preventDefault()
        const targetPath = DESTINATION_MAP[key]
        dismiss()

        if (onNavigate) {
          onNavigate(targetPath)
        } else {
          router.push(targetPath)
        }
      } else {
        // Any other key or expired chord cancels the sequence
        dismiss()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [
    isPending,
    chordTimeout,
    dismissTimeout,
    onNavigate,
    router,
    dismiss,
    clearTimers,
  ])

  return { isPending, dismiss }
}
