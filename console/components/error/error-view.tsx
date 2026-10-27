"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code2,
  Compass,
  Copy,
  FolderGit2,
  Home,
  KeyRound,
  LogIn,
  RefreshCw,
  ScrollText,
  Server,
  ServerOff,
  ShieldAlert,
  Terminal,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { copyToClipboard } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

export interface ErrorViewProps {
  statusCode: "401" | "403" | "404" | "500" | "503" | string
  title: string
  description: string
  diagnosticInfo?: {
    digest?: string
    message?: string
    timestamp?: string
    path?: string
    stack?: string
  }
  onReset?: () => void
  showQuickLinks?: boolean
}

interface StatusConfig {
  badgeLabel: string
  badgeClass: string
  icon: React.ComponentType<{ className?: string }>
  iconBoxClass: string
  statusText: string
  statusColorClass: string
  defaultDigest: string
  defaultMessage: string
  primaryAction: "reset" | "login" | "dashboard"
}

const emptySubscribe = () => () => {}

const STATUS_CONFIGS: Record<string, StatusConfig> = {
  "401": {
    badgeLabel: "HTTP 401 // UNAUTHORIZED",
    badgeClass: "border-primary/30 text-primary bg-primary/5",
    icon: KeyRound,
    iconBoxClass: "border-primary/30 bg-primary/10 text-primary",
    statusText: "401 Unauthorized",
    statusColorClass: "text-primary",
    defaultDigest: "TOKEN_EXPIRED_OR_ABSENT",
    defaultMessage:
      "Missing or expired authorization bearer token. Cluster handshake rejected.",
    primaryAction: "login",
  },
  "403": {
    badgeLabel: "HTTP 403 // ACCESS_DENIED",
    badgeClass: "border-destructive/30 text-destructive bg-destructive/5",
    icon: ShieldAlert,
    iconBoxClass: "border-destructive/30 bg-destructive/10 text-destructive",
    statusText: "403 Forbidden",
    statusColorClass: "text-destructive",
    defaultDigest: "AUTH_ROLE_INSUFFICIENT_SCOPE",
    defaultMessage:
      "Security policy disallows access to this control plane subsystem for the authenticated identity.",
    primaryAction: "dashboard",
  },
  "404": {
    badgeLabel: "HTTP 404 // ROUTE_NOT_FOUND",
    badgeClass: "border-amber-500/30 text-amber-500 bg-amber-500/5",
    icon: Compass,
    iconBoxClass: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    statusText: "404 Not Found",
    statusColorClass: "text-amber-500 dark:text-amber-400",
    defaultDigest: "ROUTE_NOT_REGISTERED",
    defaultMessage:
      "Specified URI endpoint does not resolve to an active edge route.",
    primaryAction: "dashboard",
  },
  "500": {
    badgeLabel: "HTTP 500 // INTERNAL_SYSTEM_FAULT",
    badgeClass: "border-destructive/30 text-destructive bg-destructive/5",
    icon: AlertTriangle,
    iconBoxClass: "border-destructive/30 bg-destructive/10 text-destructive",
    statusText: "500 Internal Server Error",
    statusColorClass: "text-destructive",
    defaultDigest: "SYS_FAULT_DAEMON_TIMEOUT",
    defaultMessage:
      "Internal execution error occurred in daemon telemetry pipeline.",
    primaryAction: "reset",
  },
  "503": {
    badgeLabel: "HTTP 503 // SERVICE_UNAVAILABLE",
    badgeClass: "border-amber-500/30 text-amber-500 bg-amber-500/5",
    icon: ServerOff,
    iconBoxClass: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    statusText: "503 Service Unavailable",
    statusColorClass: "text-amber-500 dark:text-amber-400",
    defaultDigest: "CLUSTER_EDGE_DRAINING",
    defaultMessage:
      "Target cluster node is currently unreachable, draining traffic, or undergoing maintenance.",
    primaryAction: "reset",
  },
}

export function ErrorView({
  statusCode,
  title,
  description,
  diagnosticInfo,
  onReset,
  showQuickLinks = true,
}: ErrorViewProps) {
  const router = useRouter()
  const [copiedReport, setCopiedReport] = React.useState(false)
  const [copiedStack, setCopiedStack] = React.useState(false)
  const [stackExpanded, setStackExpanded] = React.useState(true)

  const isDev = process.env.NODE_ENV === "development"

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

  const config: StatusConfig = STATUS_CONFIGS[statusCode] || {
    badgeLabel: `HTTP ${statusCode} // EXCEPTION`,
    badgeClass: "border-primary/30 text-primary bg-primary/5",
    icon: AlertTriangle,
    iconBoxClass: "border-border bg-muted/40 text-muted-foreground",
    statusText: `${statusCode} Exception`,
    statusColorClass: "text-primary",
    defaultDigest: "GENERIC_HTTP_EXCEPTION",
    defaultMessage: "An unhandled HTTP error condition was encountered.",
    primaryAction: "dashboard",
  }

  const StatusIcon = config.icon
  const is500 = statusCode === "500"
  const is401 = statusCode === "401"
  const is403 = statusCode === "403"
  const is503 = statusCode === "503"

  const displayPath = diagnosticInfo?.path || currentPath || "/"
  const displayTime =
    diagnosticInfo?.timestamp || currentTimestamp || "2026-10-18 08:30:00"
  const displayDigest = diagnosticInfo?.digest || config.defaultDigest
  const displayMessage = diagnosticInfo?.message || config.defaultMessage

  const hasStack = Boolean(diagnosticInfo?.stack)
  // Stack trace is preserved and displayed in development mode
  const showDevStack = hasStack && (isDev || is500)

  const handleCopyDiagnostic = async () => {
    const lines = [
      "=== TAKO TELEMETRY INCIDENT REPORT ===",
      `STATUS_CODE : ${statusCode}`,
      `ERROR_TITLE : ${title}`,
      `ENDPOINT_URI: ${displayPath}`,
      `TIMESTAMP   : ${displayTime}`,
      `DIGEST_REF  : ${displayDigest}`,
      `MESSAGE     : ${displayMessage}`,
    ]

    if (diagnosticInfo?.stack) {
      lines.push(
        "",
        "--- RUNTIME STACK TRACE ---",
        diagnosticInfo.stack,
        "---------------------------"
      )
    }

    lines.push(
      "CLUSTER_NODE: tako-master-sg01 (ap-southeast-1)",
      "======================================"
    )

    if (await copyToClipboard(lines.join("\n"))) {
      setCopiedReport(true)
      setTimeout(() => setCopiedReport(false), 2000)
    }
  }

  const handleCopyStack = async () => {
    if (!diagnosticInfo?.stack) return
    if (await copyToClipboard(diagnosticInfo.stack)) {
      setCopiedStack(true)
      setTimeout(() => setCopiedStack(false), 2000)
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
      {/* Floating Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Main Error Card */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              {/* Status Pill Badge */}
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold tracking-wider uppercase",
                  config.badgeClass
                )}
              >
                <StatusIcon className="size-3.5" />
                <span>{config.badgeLabel}</span>
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
                config.iconBoxClass
              )}
            >
              <StatusIcon className="size-7" />
            </div>
          </div>

          {/* Terminal Diagnostic Block */}
          <div className="mt-6 rounded-md border border-border bg-muted/60 p-4 font-mono text-xs text-foreground dark:bg-background">
            <div className="mb-2.5 flex items-center justify-between border-b border-border pb-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Terminal className="size-3.5 text-primary" />
                INCIDENT TELEMETRY LOG
              </span>
              <span className="text-[10px] text-muted-foreground uppercase">
                tako_runtime_v2
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] leading-relaxed">
              <div className="flex flex-col sm:flex-row">
                <span className="w-28 shrink-0 text-muted-foreground">
                  ENDPOINT_URI
                </span>
                <span className="font-semibold break-all text-foreground">
                  {displayPath}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row">
                <span className="w-28 shrink-0 text-muted-foreground">
                  TIMESTAMP
                </span>
                <span className="text-foreground">{displayTime}</span>
              </div>
              <div className="flex flex-col sm:flex-row">
                <span className="w-28 shrink-0 text-muted-foreground">
                  STATUS_CODE
                </span>
                <span className={cn("font-semibold", config.statusColorClass)}>
                  {config.statusText}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row">
                <span className="w-28 shrink-0 text-muted-foreground">
                  DIGEST_REF
                </span>
                <span className="text-foreground">{displayDigest}</span>
              </div>
              <div className="flex flex-col sm:flex-row">
                <span className="w-28 shrink-0 text-muted-foreground">
                  DIAGNOSTIC
                </span>
                <span className="break-words text-foreground">
                  {displayMessage}
                </span>
              </div>
            </div>
          </div>

          {/* Development Stack Trace Panel (Preserved in dev mode) */}
          {showDevStack && diagnosticInfo?.stack && (
            <div className="mt-4 overflow-hidden rounded-md border border-destructive/30 bg-background text-foreground dark:bg-neutral-950">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Code2 className="size-3.5 text-primary" />
                  <span className="font-mono text-[11px] font-semibold tracking-wider text-foreground uppercase">
                    Developer Stack Trace
                  </span>
                  <span className="rounded-xs bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-500">
                    DEV MODE
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleCopyStack}
                    className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    title="Copy raw stack trace to clipboard"
                  >
                    {copiedStack ? (
                      <>
                        <Check className="size-3 text-emerald-500" />
                        <span className="font-medium text-emerald-500">
                          Copied
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy Stack</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setStackExpanded(!stackExpanded)}
                    className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    aria-label={
                      stackExpanded
                        ? "Collapse stack trace"
                        : "Expand stack trace"
                    }
                  >
                    {stackExpanded ? (
                      <>
                        <ChevronUp className="size-3" />
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3" />
                        <span>Show</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {stackExpanded && (
                <div className="max-h-64 overflow-x-auto overflow-y-auto p-3 font-mono text-[11px] leading-relaxed select-text">
                  <pre className="text-muted-foreground">
                    {diagnosticInfo.stack.split("\n").map((line, idx) => {
                      const isProjectFile =
                        line.includes("app/") ||
                        line.includes("components/") ||
                        line.includes("lib/")
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "py-0.5",
                            idx === 0
                              ? "font-semibold text-destructive dark:text-red-400"
                              : isProjectFile
                                ? "rounded-xs bg-primary/10 px-1 font-medium text-foreground"
                                : "text-muted-foreground/70"
                          )}
                        >
                          {line}
                        </div>
                      )
                    })}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* Primary Action Button */}
            {is401 ? (
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "default" }), "gap-2")}
              >
                <LogIn className="size-3.5" />
                Log In to Platform
              </Link>
            ) : onReset ? (
              <Button onClick={onReset} className="gap-2">
                <RefreshCw className="size-3.5" />
                Try Again
              </Button>
            ) : is500 || is503 ? (
              <Button
                onClick={() => window.location.reload()}
                className="gap-2"
              >
                <RefreshCw className="size-3.5" />
                Reload Page
              </Button>
            ) : (
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "default" }), "gap-2")}
              >
                <Home className="size-3.5" />
                Return to Dashboard
              </Link>
            )}

            {/* Secondary Action: Return to Dashboard (if not already primary) */}
            {(is401 || onReset || is500 || is503) && (
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
              >
                <Home className="size-3.5" />
                Dashboard
              </Link>
            )}

            {/* Switch Account for 403 Forbidden */}
            {is403 && (
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
              >
                <LogIn className="size-3.5" />
                Switch Account
              </Link>
            )}

            {/* Previous Page Button */}
            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeft className="size-3.5" />
              Previous Page
            </Button>

            {/* Copy Incident Telemetry Report */}
            <Button
              variant="ghost"
              onClick={handleCopyDiagnostic}
              className="gap-2 text-xs text-muted-foreground hover:text-foreground sm:ml-auto"
              title="Copy incident report for support or telemetry tracing"
            >
              {copiedReport ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  <span className="font-medium text-emerald-500">
                    Report Copied
                  </span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy Report</span>
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
                <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
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
                <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
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
                <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
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
                <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
