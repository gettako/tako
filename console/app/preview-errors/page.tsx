"use client"

import * as React from "react"
import { Bug, Eye, EyeOff, SlidersHorizontal } from "lucide-react"

import { ErrorView } from "@/components/error/error-view"
import { ThemeToggle } from "@/components/theme-toggle"

type ErrorMode = "404" | "403" | "401" | "500" | "503"

export default function PreviewErrorsPage() {
  const [mode, setMode] = React.useState<ErrorMode>("404")
  const [includeStackTrace, setIncludeStackTrace] = React.useState(true)
  const [showToolbar, setShowToolbar] = React.useState(true)
  const [shouldCrash, setShouldCrash] = React.useState(false)

  // Trigger real runtime error to test app/error.tsx error boundary
  if (shouldCrash) {
    throw new Error(
      "Simulated cluster connection timeout at edge daemon cluster-sg01: unreachable socket /var/run/tako.sock"
    )
  }

  const sampleStackTrace = `Error: Internal execution timeout during telemetry state reconciliation
    at reconcileClusterState (app/lib/telemetry.ts:142:18)
    at async dispatchEdgeCommand (app/lib/adapters.ts:88:9)
    at async RouteHandler (app/api/v1/[...path]/route.ts:45:12)
    at async processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async Server.handleRequest (node_modules/next/dist/server/app-render/app-render.js:842:21)`

  const renderContent = () => {
    switch (mode) {
      case "401":
        return (
          <ErrorView
            statusCode="401"
            title="Authentication Required"
            description="No valid cryptographic session token was detected. Please authenticate to establish a secure handshake with the Tako control plane."
          />
        )
      case "403":
        return (
          <ErrorView
            statusCode="403"
            title="Access Forbidden"
            description="Your current role or session token lacks authorization to access this edge cluster resource or control plane subsystem. Contact your cluster administrator if you require escalated permissions."
          />
        )
      case "404":
        return (
          <ErrorView
            statusCode="404"
            title="Page or Resource Not Found"
            description="The requested path does not match any registered edge endpoints, container services, or telemetry streams. It may have been deleted, moved, or entered incorrectly."
          />
        )
      case "500":
        return (
          <ErrorView
            statusCode="500"
            title="Internal System Fault"
            description="An unhandled exception occurred in the platform runtime pipeline. Edge daemon processes and active container workloads remain isolated and operational."
            diagnosticInfo={{
              digest: "ERR_500_DAEMON_TIMEOUT",
              message:
                "Internal execution timeout occurred during telemetry state reconciliation.",
              stack: includeStackTrace ? sampleStackTrace : undefined,
            }}
          />
        )
      case "503":
        return (
          <ErrorView
            statusCode="503"
            title="Cluster Node Unavailable"
            description="The target edge cluster node is temporarily draining active connections or undergoing scheduled rolling maintenance. Autonomous local containers remain running."
            diagnosticInfo={{
              digest: "NODE_DRAIN_IN_PROGRESS",
              message:
                "Edge daemon reported state: DRAINING_ACTIVE_TRAFFIC (node-sg01).",
            }}
          />
        )
    }
  }

  return (
    <div className="relative min-h-screen w-full">
      {renderContent()}

      {/* Floating Preview Control Panel */}
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
        {showToolbar ? (
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card/95 px-3.5 py-2 shadow-lg backdrop-blur-md sm:rounded-full sm:py-1.5">
            <div className="flex items-center gap-1.5 border-r border-border/80 pr-2 font-mono text-[11px] font-semibold text-foreground">
              <SlidersHorizontal className="size-3 text-primary" />
              <span>Status</span>
            </div>

            {/* Error Code Selector */}
            <div className="flex items-center gap-1 border-r border-border/80 pr-2">
              {(["404", "403", "401", "500", "503"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setMode(code)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    mode === code
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>

            {/* Dev Stack Trace Toggle for 500 */}
            {mode === "500" && (
              <div className="flex items-center gap-1 border-r border-border/80 pr-2">
                <button
                  type="button"
                  onClick={() => setIncludeStackTrace(!includeStackTrace)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    includeStackTrace
                      ? "bg-muted font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  title="Toggle Dev Stack Trace in ErrorView"
                >
                  {includeStackTrace ? "Stack: ON" : "Stack: OFF"}
                </button>
              </div>
            )}

            {/* Real Crash Trigger */}
            <div className="flex items-center gap-1 border-r border-border/80 pr-2">
              <button
                type="button"
                onClick={() => setShouldCrash(true)}
                className="flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/25"
                title="Throw an unhandled runtime error to test app/error.tsx boundary"
              >
                <Bug className="size-3 text-destructive" />
                <span>Test Real 500</span>
              </button>
            </div>

            {/* Theme & Hide Toolbar */}
            <div className="flex items-center gap-1">
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
            <span>Show error controls</span>
          </button>
        )}
      </div>
    </div>
  )
}
