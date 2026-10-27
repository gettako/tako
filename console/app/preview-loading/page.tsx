"use client"

import * as React from "react"
import { Eye, EyeOff, SlidersHorizontal } from "lucide-react"

import { ControlPlaneLoading } from "@/components/layout/control-plane-loading"
import { ThemeToggle } from "@/components/theme-toggle"

export default function PreviewLoadingPage() {
  const [forceTimeout, setForceTimeout] = React.useState(false)
  const [frameless, setFrameless] = React.useState(false)
  const [showToolbar, setShowToolbar] = React.useState(true)

  return (
    <div className="relative min-h-screen w-full">
      {/* The actual loading view */}
      <ControlPlaneLoading
        forceShowTimeout={forceTimeout}
        framelessCard={frameless}
      />

      {/* Floating Preview Control Panel */}
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
        {showToolbar ? (
          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/90 px-3.5 py-1.5 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5 border-r border-border/80 pr-2 font-mono text-[11px] font-semibold text-foreground">
              <SlidersHorizontal className="size-3 text-primary" />
              <span>Preview</span>
            </div>

            {/* Container Style Toggle */}
            <div className="flex items-center gap-1 border-r border-border/80 pr-2">
              <button
                type="button"
                onClick={() => setFrameless(false)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  !frameless
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
                title="Container with card border and subtle background"
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setFrameless(true)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  frameless
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
                title="Frameless without surrounding card"
              >
                Frameless
              </button>
            </div>

            {/* State Toggle */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setForceTimeout(false)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  !forceTimeout
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                Normal
              </button>

              <button
                type="button"
                onClick={() => setForceTimeout(true)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  forceTimeout
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                Timeout (&gt;10s)
              </button>
            </div>

            {/* Theme & Hide */}
            <div className="flex items-center gap-1 border-l border-border/80 pl-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setShowToolbar(false)}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Hide preview toolbar"
                aria-label="Hide preview toolbar"
              >
                <EyeOff className="size-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowToolbar(true)}
            className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/90 px-3 py-1 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-muted"
          >
            <Eye className="size-3 text-primary" />
            <span>Show controls</span>
          </button>
        )}
      </div>
    </div>
  )
}
