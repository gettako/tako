"use client"

import * as React from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  Download,
  GitBranch,
  Loader2,
  RotateCcw,
  Search,
  Terminal,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { usePlatformData } from "@/context/platform-data-context"
import {
  DeploymentRecord,
  DeploymentStepName,
  ProjectService,
} from "@/types/platform"
import { StepBadgeBar } from "./deployments/step-badge-bar"
import { DeploymentHistoryTable } from "./deployments/deployment-history-table"
import { copyToClipboard } from "@/lib/clipboard"
import {
  generateLogsForDeployment,
  generateStepsForDeployment,
  STEP_KEYWORDS,
} from "@/lib/deployment-mock"
import { cn } from "@/lib/utils"
import { formatCommitHash } from "@/lib/adapters"

interface ServiceDeploymentsTabProps {
  service: ProjectService
}

export function ServiceDeploymentsTab({ service }: ServiceDeploymentsTabProps) {
  const {
    triggerRollback,
    activeDeployingId,
    deploymentLogs,
    fetchServiceDeployments,
  } = usePlatformData()

  const isDeploying =
    activeDeployingId === service.id || service.status === "deploying"

  const [fetchedDeployments, setFetchedDeployments] = React.useState<
    DeploymentRecord[] | null
  >(null)
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false)

  const loadDeployments = React.useCallback(async () => {
    if (!service?.id) return
    setIsLoadingHistory(true)
    try {
      const records = await fetchServiceDeployments(service.id)
      setFetchedDeployments(records)
    } catch (err) {
      console.error("Failed to fetch deployments:", err)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [fetchServiceDeployments, service?.id])

  React.useEffect(() => {
    void loadDeployments()
  }, [loadDeployments])

  // When deploying status toggles (e.g. starts or finishes), reload full history
  const prevDeployingRef = React.useRef(isDeploying)
  React.useEffect(() => {
    if (prevDeployingRef.current !== isDeploying) {
      void loadDeployments()
    }
    prevDeployingRef.current = isDeploying
  }, [isDeploying, loadDeployments])

  // Deployment history list
  const history = React.useMemo(() => {
    if (fetchedDeployments && fetchedDeployments.length > 0) {
      return fetchedDeployments
    }
    return service.deploymentHistory && service.deploymentHistory.length > 0
      ? service.deploymentHistory
      : service.lastDeployment && service.lastDeployment.id
        ? [service.lastDeployment]
        : []
  }, [fetchedDeployments, service.deploymentHistory, service.lastDeployment])

  // User manual selection state for inspecting historical releases
  const [userSelectedDeploymentId, setUserSelectedDeploymentId] =
    React.useState<string | null>(null)

  // Selected deployment ID: defaults to active deploying build if active, otherwise user selection or latest
  const selectedDeploymentId =
    isDeploying && history[0]
      ? history[0].id
      : userSelectedDeploymentId ||
        service.lastDeployment.id ||
        history[0]?.id ||
        "dep-latest"

  // Resolve selected deployment object
  const selectedDeployment = React.useMemo(() => {
    const found = history.find((d) => d.id === selectedDeploymentId)
    return found || history[0] || service.lastDeployment
  }, [history, selectedDeploymentId, service.lastDeployment])

  const activeDeploymentId = service.lastDeployment?.id || history[0]?.id

  const isSelectedActiveRelease =
    (selectedDeployment.id
      ? selectedDeployment.id === activeDeploymentId
      : selectedDeployment.commitHash === service.lastDeployment?.commitHash) &&
    !isDeploying
  const isSelectedDeploying =
    isDeploying && selectedDeployment.id === history[0]?.id
  const isSelectedFailed = selectedDeployment.status === "failed"

  // Step filter for pipeline & log sync
  const [selectedStepName, setSelectedStepName] =
    React.useState<DeploymentStepName | null>(null)

  // Toggle log viewer (collapsed by default to keep pipeline compact and show table immediately)
  const [showLogs, setShowLogs] = React.useState<boolean>(false)

  // Log viewer controls
  const [logFilter, setLogFilter] = React.useState<
    "all" | "info" | "success" | "warn" | "error"
  >("all")
  const [logSearch, setLogSearch] = React.useState("")
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [copiedLog, setCopiedLog] = React.useState(false)

  // Rollback dialog
  const [rollbackTarget, setRollbackTarget] =
    React.useState<DeploymentRecord | null>(null)
  const [isRollingBack, setIsRollingBack] = React.useState(false)

  // Webhook info modal
  const [showWebhookInfo, setShowWebhookInfo] = React.useState(false)

  const logContainerRef = React.useRef<HTMLDivElement>(null)
  const errorLineRef = React.useRef<HTMLDivElement>(null)

  // Derive 7-step pipeline steps for the selected deployment
  const pipelineSteps = React.useMemo(() => {
    return generateStepsForDeployment(
      selectedDeployment,
      isSelectedDeploying,
      service.targetNodeId
    )
  }, [selectedDeployment, isSelectedDeploying, service.targetNodeId])

  // Derive logs for the selected deployment
  const logsForSelectedDeployment = React.useMemo(() => {
    return generateLogsForDeployment(
      selectedDeployment,
      service,
      deploymentLogs,
      isSelectedDeploying
    )
  }, [selectedDeployment, service, deploymentLogs, isSelectedDeploying])

  // Filter logs based on step selection, log level, and search text
  const filteredLogs = React.useMemo(() => {
    return logsForSelectedDeployment.filter((log) => {
      // Step sync filter
      if (selectedStepName) {
        const keywords = STEP_KEYWORDS[selectedStepName] || [
          selectedStepName.toLowerCase(),
        ]
        const text = `${log.step} ${log.message}`.toLowerCase()
        const matchesKeyword = keywords.some((kw) => text.includes(kw))
        if (!matchesKeyword) return false
      }

      // Level filter
      const matchesLevel = logFilter === "all" ? true : log.level === logFilter

      // Search query
      const matchesSearch = logSearch
        ? log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
          log.step.toLowerCase().includes(logSearch.toLowerCase())
        : true

      return matchesLevel && matchesSearch
    })
  }, [logsForSelectedDeployment, selectedStepName, logFilter, logSearch])

  const hasErrorLog = React.useMemo(() => {
    return logsForSelectedDeployment.some((l) => l.level === "error")
  }, [logsForSelectedDeployment])

  // Auto-scroll effect
  React.useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [filteredLogs, autoScroll])

  const handleCopyLogs = async () => {
    const fullText = logsForSelectedDeployment
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.step}] ${l.message}`
      )
      .join("\n")

    if (await copyToClipboard(fullText)) {
      setCopiedLog(true)
      setTimeout(() => setCopiedLog(false), 2000)
    }
  }

  const handleDownloadLogs = () => {
    const fullText = logsForSelectedDeployment
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.step}] ${l.message}`
      )
      .join("\n")
    const blob = new Blob([fullText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${service.slug}-deployment-${selectedDeployment.commitHash}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleJumpToError = () => {
    setSelectedStepName(null)
    setLogFilter("error")
    setTimeout(() => {
      if (errorLineRef.current) {
        errorLineRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }
    }, 50)
  }

  const handleOpenRollbackDialog = (dep: DeploymentRecord) => {
    setRollbackTarget(dep)
  }

  const handleConfirmRollback = async () => {
    if (!rollbackTarget) return
    setIsRollingBack(true)
    try {
      await triggerRollback(service.id, rollbackTarget)
      await loadDeployments()
    } finally {
      setIsRollingBack(false)
      setRollbackTarget(null)
    }
  }

  const handleSelectDeploymentFromTable = (dep: DeploymentRecord) => {
    setUserSelectedDeploymentId(dep.id)
    setSelectedStepName(null)
  }

  const handleSelectActiveProduction = () => {
    setUserSelectedDeploymentId(service.lastDeployment.id || history[0]?.id)
    setSelectedStepName(null)
  }

  return (
    <div className="space-y-6">
      {/* Unified Pipeline Card (Clean & Compact) */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-foreground sm:text-base">
                {isSelectedActiveRelease
                  ? "Deployment Pipeline"
                  : "Inspecting Release"}
              </span>

              {/* Status Pill */}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium",
                  isSelectedDeploying
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : isSelectedFailed
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                )}
              >
                {isSelectedDeploying ? (
                  <Loader2 className="size-3 animate-spin text-primary" />
                ) : isSelectedFailed ? (
                  <AlertTriangle className="size-3 text-rose-500" />
                ) : (
                  <span className="size-2 rounded-full bg-emerald-500" />
                )}
                <span className="capitalize">
                  {isSelectedDeploying
                    ? "Deploying (in progress)"
                    : isSelectedFailed
                      ? "Build Failed"
                      : isSelectedActiveRelease
                        ? "Active Production"
                        : "Verified Build"}
                </span>
              </div>

              {/* Commit Hash badge */}
              <span
                className="rounded border border-border/80 bg-muted/40 px-2 py-0.5 font-mono text-xs font-semibold text-primary"
                title={selectedDeployment.commitHash}
              >
                commit {formatCommitHash(selectedDeployment.commitHash)}
              </span>

              {/* Git Branch badge */}
              <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <GitBranch className="size-3" />
                <span>{selectedDeployment.branch || service.gitBranch}</span>
              </div>

              {selectedDeployment.isRollback && (
                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 font-mono text-[10px] font-medium text-amber-500 uppercase">
                  Rollback
                </span>
              )}
            </div>

            {/* Commit Message & Metadata (Natural readable sentence, no chained bullets) */}
            <p className="truncate font-mono text-xs text-muted-foreground">
              <span className="font-medium text-foreground/90">
                &quot;{selectedDeployment.message}&quot;
              </span>{" "}
              <span className="text-muted-foreground/75">by</span>{" "}
              <span className="text-foreground/80">
                {selectedDeployment.triggerBy}
              </span>{" "}
              <span className="text-muted-foreground/60">
                ({selectedDeployment.startedAt})
              </span>
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!isSelectedActiveRelease && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectActiveProduction}
                className="gap-1 font-mono text-[11px] text-foreground hover:border-primary hover:text-primary"
                title="Return to currently active production release"
              >
                <span>Jump to Active</span>
                <ArrowRight className="size-3" />
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowLogs((prev) => !prev)}
              className={cn(
                "gap-1.5 font-mono text-[11px] transition-colors",
                showLogs
                  ? "border-primary/50 bg-primary/5 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Terminal className="size-3.5" />
              <span>{showLogs ? "Hide Output" : "View Output"}</span>
            </Button>
          </div>
        </div>

        {/* 7-Step Pipeline Progress Bar per Step with Timestamps */}
        <div className="mt-3.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Pipeline Stages
              </span>
              <button
                type="button"
                onClick={() => setShowWebhookInfo(true)}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                title="View Git webhook auto-deploy settings"
              >
                <Zap className="size-3 text-amber-500" />
                <span>Auto-Deploy: ON</span>
              </button>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-muted-foreground">
                Duration:{" "}
                <strong className="text-foreground">
                  {selectedDeployment.duration}
                </strong>
              </span>
              {selectedStepName && (
                <button
                  type="button"
                  onClick={() => setSelectedStepName(null)}
                  className="text-primary hover:underline"
                >
                  Clear Filter ({selectedStepName})
                </button>
              )}
            </div>
          </div>

          <StepBadgeBar
            steps={pipelineSteps}
            activeStepName={selectedStepName}
            onSelectStep={(stepName) => {
              setSelectedStepName((prev) =>
                prev === stepName ? null : stepName
              )
              setShowLogs(true)
            }}
          />
        </div>

        {/* Integrated Terminal Log Viewer (shown when toggled or deploying) */}
        {(showLogs || isDeploying) && (
          <div className="mt-5 overflow-hidden rounded-md border border-border bg-card dark:bg-background">
            {/* Terminal Toolbar */}
            <div className="flex flex-col gap-2.5 border-b border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Terminal className="size-4 text-primary" />
                <span
                  className="font-mono text-xs font-semibold text-foreground"
                  title={selectedDeployment.commitHash}
                >
                  Logs: commit {formatCommitHash(selectedDeployment.commitHash)}
                </span>

                {selectedStepName && (
                  <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    Stage: {selectedStepName}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* Jump to error button if errors exist */}
                {hasErrorLog && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    onClick={handleJumpToError}
                    className="h-7 gap-1 px-2 font-mono text-[11px]"
                  >
                    <AlertTriangle className="size-3" />
                    <span>Jump to Error</span>
                  </Button>
                )}

                {/* Search Input */}
                <div className="relative w-32 sm:w-40">
                  <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search logs..."
                    className="h-7 bg-background pl-7 font-mono text-[11px] placeholder:text-muted-foreground"
                  />
                </div>

                {/* Level Filter Tabs */}
                <div className="flex rounded border border-border bg-muted/40 p-0.5 font-mono text-[10px]">
                  {(["all", "info", "warn", "error"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLogFilter(lvl)}
                      className={cn(
                        "rounded px-1.5 py-0.5 capitalize transition-colors",
                        logFilter === lvl
                          ? "bg-card font-semibold text-foreground dark:bg-muted dark:text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                {/* Auto-scroll toggle */}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setAutoScroll((prev) => !prev)}
                  className={cn(
                    "h-7 px-2 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground",
                    autoScroll && "border-primary/50 text-primary"
                  )}
                >
                  Auto-scroll
                </Button>

                {/* Copy button */}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleCopyLogs}
                  className="h-7 px-2 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Copy logs"
                >
                  {copiedLog ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>

                {/* Download button */}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleDownloadLogs}
                  className="h-7 px-2 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Download log file"
                >
                  <Download className="size-3" />
                </Button>
              </div>
            </div>

            {/* Terminal Viewport */}
            <div
              ref={logContainerRef}
              className="h-72 overflow-y-auto bg-muted/10 p-3.5 font-mono text-xs leading-relaxed text-foreground select-text dark:bg-background dark:text-foreground/90"
            >
              {filteredLogs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                  <p>No log records matching current filter.</p>
                  {selectedStepName && (
                    <button
                      type="button"
                      onClick={() => setSelectedStepName(null)}
                      className="text-primary hover:underline"
                    >
                      Reset step filter to view all logs
                    </button>
                  )}
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isError = log.level === "error"
                  return (
                    <div
                      key={log.id}
                      ref={isError ? errorLineRef : undefined}
                      className={cn(
                        "flex items-start gap-2 py-0.5 transition-colors hover:bg-muted/50 dark:hover:bg-zinc-900/60",
                        isError &&
                          "rounded bg-rose-500/10 px-1 py-1 ring-1 ring-rose-500/30 dark:bg-rose-950/40 dark:ring-rose-500/40"
                      )}
                    >
                      <span className="shrink-0 text-muted-foreground/70 select-none dark:text-zinc-500">
                        [{log.timestamp}]
                      </span>

                      <span
                        className={cn(
                          "py-0.2 shrink-0 rounded px-1.5 text-[10px] font-bold uppercase",
                          log.level === "info" &&
                            "bg-sky-500/10 text-sky-700 dark:bg-sky-950/80 dark:text-sky-400",
                          log.level === "success" &&
                            "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400",
                          log.level === "warn" &&
                            "bg-amber-500/10 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400",
                          log.level === "error" &&
                            "bg-rose-500/10 font-extrabold text-rose-700 dark:bg-rose-950/80 dark:text-rose-400"
                        )}
                      >
                        {log.level}
                      </span>

                      <span className="shrink-0 font-semibold text-muted-foreground dark:text-zinc-400">
                        [{log.step}]
                      </span>

                      <span
                        className={cn(
                          "break-all text-foreground/90 dark:text-zinc-200",
                          isError &&
                            "font-semibold text-rose-600 dark:text-rose-300"
                        )}
                      >
                        {log.message}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Deployment History Table (Clicking row adapts the pipeline information above) */}
      <DeploymentHistoryTable
        deployments={history}
        selectedDeploymentId={selectedDeployment.id}
        onSelectDeployment={handleSelectDeploymentFromTable}
        onRequestRollback={handleOpenRollbackDialog}
        isDeploying={isDeploying}
        activeDeploymentId={activeDeploymentId}
        activeCommitHash={service.lastDeployment?.commitHash}
        isLoading={isLoadingHistory}
        onRefresh={loadDeployments}
      />

      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={!!rollbackTarget}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <RotateCcw className="size-4 text-primary" />
              <span>Confirm Instant Rollback</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Zero-downtime container switch to a prior verified build image.
            </DialogDescription>
          </DialogHeader>

          {rollbackTarget && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="rounded-md border border-border/80 bg-muted/20 p-3.5">
                <div className="flex items-center justify-between font-mono">
                  <span
                    className="font-semibold text-foreground"
                    title={rollbackTarget.commitHash}
                  >
                    Target Revision: commit {formatCommitHash(rollbackTarget.commitHash)}
                  </span>
                  <span className="text-muted-foreground">
                    {rollbackTarget.startedAt}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-foreground">
                  {rollbackTarget.message}
                </p>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Original duration: {rollbackTarget.duration} • Trigger:{" "}
                  {rollbackTarget.triggerBy}
                </div>
              </div>

              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-amber-500">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="text-[11px] leading-relaxed text-amber-500 dark:text-amber-400">
                    Rollback will instruct the edge agent on{" "}
                    <strong>{service.targetNodeId}</strong> to swap ingress
                    traffic to container image{" "}
                    <strong title={rollbackTarget.commitHash}>
                      tako/{service.slug}:{formatCommitHash(rollbackTarget.commitHash)}
                    </strong>
                    .
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRollingBack}
              onClick={() => setRollbackTarget(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isRollingBack}
              onClick={handleConfirmRollback}
              className="gap-1.5 text-xs"
            >
              {isRollingBack ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Rolling back...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="size-3.5" />
                  <span>Execute Rollback</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook CI/CD Helper Modal */}
      <Dialog open={showWebhookInfo} onOpenChange={setShowWebhookInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Zap className="size-4 text-primary" />
              <span>Git Push Automation Webhook</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tako automatically compiles and deploys every push to branch{" "}
              <code className="text-foreground">{service.gitBranch}</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-3 font-mono text-[11px]">
              <span className="text-muted-foreground">
                Incoming Webhook Endpoint:
              </span>
              <div className="rounded bg-zinc-950 p-2 break-all text-zinc-200">
                https://api.tako.internal/v1/webhooks/deploy/{service.id}
              </div>
            </div>

            <p className="text-muted-foreground">
              You can trigger deployments directly from GitHub Actions, GitLab
              CI, or local git hooks without opening the console:
            </p>

            <div className="rounded bg-zinc-950 p-2.5 font-mono text-[11px] text-zinc-300">
              curl -X POST https://api.tako.internal/v1/webhooks/deploy/
              {service.id} \
              <br />
              &nbsp;&nbsp;-H &quot;Authorization: Bearer tako_sec_***&quot;
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowWebhookInfo(false)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
