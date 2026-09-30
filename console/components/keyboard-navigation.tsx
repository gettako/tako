"use client"

import * as React from "react"
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation"

export function KeyboardNavigation() {
  const { isPending } = useKeyboardNavigation()

  if (!isPending) return null

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Keyboard navigation cheat sheet"
      className="pointer-events-none fixed right-4 bottom-4 z-50 rounded-md border border-border bg-card p-2 font-mono text-xs text-foreground select-none"
    >
      <div className="mb-2 flex items-center justify-between gap-4 border-b border-border pb-1.5 font-mono text-2xs text-muted-foreground">
        <span className="font-semibold tracking-wider text-foreground uppercase">
          Go to...
        </span>
        <span>ESC to cancel</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Dashboard</span>
          <div className="flex items-center gap-1 font-semibold">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs text-foreground">
              G
            </kbd>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs text-foreground">
              D
            </kbd>
          </div>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Projects</span>
          <div className="flex items-center gap-1 font-semibold">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs text-foreground">
              G
            </kbd>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs text-foreground">
              P
            </kbd>
          </div>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Servers</span>
          <div className="flex items-center gap-1 font-semibold">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs text-foreground">
              G
            </kbd>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs text-foreground">
              S
            </kbd>
          </div>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">GitHub Settings</span>
          <div className="flex items-center gap-1 font-semibold">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs text-foreground">
              G
            </kbd>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs text-foreground">
              G
            </kbd>
          </div>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Security Settings</span>
          <div className="flex items-center gap-1 font-semibold">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs text-foreground">
              G
            </kbd>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-3xs text-foreground">
              A
            </kbd>
          </div>
        </div>
      </div>
    </aside>
  )
}
