"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  Compass,
  Copy,
  FolderGit2,
  Home,
  RefreshCw,
  ScrollText,
  Server,
  Terminal,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { copyToClipboard } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

export interface ErrorViewProps {
  statusCode: "404" | "500" | string
  title: string
  description: string
  diagnosticInfo?: {
    digest?: string
    message?: string
    timestamp?: string
    path?: string
  }
  onReset?: () => void
  showQuickLinks?: boolean
}

const emptySubscribe = () => () => {}

export function ErrorView({
  statusCode,
  title,
  description,
  diagnosticInfo,
  onReset,
  showQuickLinks = true,
}: ErrorViewProps) {
  const router = useRouter()
  const [copied, setCopied] = React.useState(false)

  const currentPath = React.useSyncExternalStore(
    emptySubscribe,
    () => window.location.pathname,
    () => "/"
  )

  const currentTimestamp = React.useSyncExternalStore(
    emptySubscribe,
    () => {
      const now = new Date()
      const pad = (n: number) => n.toString().padStart(2, "0")
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    },
    () => "2026-10-18 08:30:00"
  )

  const is500 = statusCode === "500"
  const is404 = statusCode === "404"

  const displayPath = diagnosticInfo?.path || currentPath || "/"
  const displayTime =
    diagnosticInfo?.timestamp || currentTimestamp || "2026-10-18 08:30:00"
  const displayDigest =
    diagnosticInfo?.digest ||
    (is500 ? "SYS_FAULT_DAEMON_TIMEOUT" : "ROUTE_NOT_REGISTERED")
  const displayMessage =
    diagnosticInfo?.message ||
    (is500
      ? "Internal execution error occurred in daemon telemetry pipeline."
      : "Specified URI endpoint does not resolve to an active edge route.")

  const handleCopyDiagnostic = async () => {
    const payload = [
      `=== TAKO TELEMETRY INCIDENT REPORT ===`,
      `STATUS_CODE : ${statusCode}`,
      `ERROR_TITLE : ${title}`,
      `ENDPOINT_URI: ${displayPath}`,
      `TIMESTAMP   : ${displayTime}`,
      `DIGEST_REF  : ${displayDigest}`,
      `MESSAGE     : ${displayMessage}`,
      `CLUSTER_NODE: tako-master-sg01 (ap-southeast-1)`,
      `======================================`,
    ].join("\n")

    if (await copyToClipboard(payload)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground sm:p-6 lg:p-8">
      {/* Floating Theme Toggle (no header, no logo) */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Main Error Card */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              {/* Status Pill Badge */}
              <div className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold tracking-wider uppercase">
                {is500 ? (
                  <span className="flex items-center gap-1.5 border-destructive/30 text-destructive">
                    <AlertTriangle className="size-3.5 text-destructive" />
                    HTTP 500 // INTERNAL_SYSTEM_FAULT
                  </span>
                ) : is404 ? (
                  <span className="flex items-center gap-1.5 border-amber-500/30 text-amber-500">
                    <Compass className="size-3.5 text-amber-500" />
                    HTTP 404 // ROUTE_NOT_FOUND
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 border-primary/30 text-primary">
                    <AlertTriangle className="size-3.5 text-primary" />
                    HTTP {statusCode} // EXCEPTION
                  </span>
                )}
              </div>

              <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>

            <div
              className={cn(
                "hidden size-14 shrink-0 items-center justify-center rounded-lg border sm:flex",
                is500
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/40 text-muted-foreground"
              )}
            >
              {is500 ? (
                <AlertTriangle className="size-7" />
              ) : (
                <Compass className="size-7" />
              )}
            </div>
          </div>

          {/* Terminal Diagnostic Block */}
          <div className="mt-6 rounded-md border border-border bg-muted p-4 font-mono text-xs text-foreground dark:bg-background">
            <div className="mb-2.5 flex items-center justify-between border-b border-neutral-800 pb-2 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5 font-semibold text-neutral-300">
                <Terminal className="size-3.5 text-primary" />
                INCIDENT TELEMETRY LOG
              </span>
              <span className="text-[10px] text-neutral-500 uppercase">
                tako_runtime_v2
              </span>
            </div>

            <div className="space-y-1 text-[11px] leading-relaxed">
              <div className="flex">
                <span className="w-28 shrink-0 text-neutral-400">
                  ENDPOINT_URI
                </span>
                <span className="font-semibold break-all text-neutral-100">
                  {displayPath}
                </span>
              </div>
              <div className="flex">
                <span className="w-28 shrink-0 text-neutral-400">
                  TIMESTAMP
                </span>
                <span className="text-neutral-300">{displayTime}</span>
              </div>
              <div className="flex">
                <span className="w-28 shrink-0 text-neutral-400">
                  STATUS_CODE
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    is500 ? "text-red-400" : "text-amber-400"
                  )}
                >
                  {statusCode} {is500 ? "Internal Server Error" : "Not Found"}
                </span>
              </div>
              <div className="flex">
                <span className="w-28 shrink-0 text-neutral-400">
                  DIGEST_REF
                </span>
                <span className="text-neutral-300">{displayDigest}</span>
              </div>
              <div className="flex">
                <span className="w-28 shrink-0 text-neutral-400">
                  DIAGNOSTIC
                </span>
                <span className="break-words text-neutral-300">
                  {displayMessage}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {onReset ? (
              <Button onClick={onReset} className="gap-2">
                <RefreshCw className="size-3.5" />
                Try Again
              </Button>
            ) : is500 ? (
              <Button
                onClick={() => window.location.reload()}
                className="gap-2"
              >
                <RefreshCw className="size-3.5" />
                Reload Page
              </Button>
            ) : null}

            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({
                  variant: onReset || is500 ? "outline" : "default",
                }),
                "gap-2"
              )}
            >
              <Home className="size-3.5" />
              Return to Dashboard
            </Link>

            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeft className="size-3.5" />
              Previous Page
            </Button>

            <Button
              variant="ghost"
              onClick={handleCopyDiagnostic}
              className="gap-2 text-xs text-muted-foreground hover:text-foreground sm:ml-auto"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  <span className="font-medium text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Navigation Matrix */}
        {showQuickLinks && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Quick Navigation
              </span>
              <span className="text-xs text-muted-foreground">
                Registered Subsystems
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/nodes"
                className="group flex items-center justify-between rounded-lg border border-border bg-card p-3.5 transition-all hover:border-foreground/30 hover:shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground group-hover:text-foreground">
                    <Server className="size-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:underline">
                      Edge Nodes
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Inspect cluster compute nodes
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">
                  →
                </span>
              </Link>

              <Link
                href="/projects"
                className="group flex items-center justify-between rounded-lg border border-border bg-card p-3.5 transition-all hover:border-foreground/30 hover:shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground group-hover:text-foreground">
                    <FolderGit2 className="size-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:underline">
                      Projects & Services
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Container deployments & edge configs
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">
                  →
                </span>
              </Link>

              <Link
                href="/monitor"
                className="group flex items-center justify-between rounded-lg border border-border bg-card p-3.5 transition-all hover:border-foreground/30 hover:shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground group-hover:text-foreground">
                    <Activity className="size-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:underline">
                      Cluster Monitor
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Live CPU, RAM, Network & Disk charts
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">
                  →
                </span>
              </Link>

              <Link
                href="/audit-logs"
                className="group flex items-center justify-between rounded-lg border border-border bg-card p-3.5 transition-all hover:border-foreground/30 hover:shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground group-hover:text-foreground">
                    <ScrollText className="size-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:underline">
                      Audit Logs
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Historical system & actor traces
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground">
                  →
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
