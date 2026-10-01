"use client"

import * as React from "react"
import {
  RocketLaunchIcon,
  GitCommitIcon,
  GitBranchIcon,
  UserIcon,
  ClockIcon,
  ArrowCounterClockwiseIcon,
  TerminalWindowIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  WarningIcon,
  ArrowSquareOutIcon,
  TrashIcon,
  GlobeIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { StatusBadge, type StatusVariant } from "@/components/status-badge"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorCard } from "@/components/states/error-card"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { BuildLogModal } from "@/components/services/build-log-modal"
import {
  computeEnvDiff,
  EnvDiffPill,
  EnvDiffPanel,
} from "@/components/services/deployment-env-diff"
import { useService } from "@/components/services/service-context"
import { api, type Deployment, type PreviewEnvironment } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { CopyButton } from "@/components/ui/copy-button"

function CommitShaChip({ sha, fullSha }: { sha: string; fullSha?: string }) {
  const { copy, isCopied, error } = useCopyToClipboard(2000)

  return (
    <button
      type="button"
      onClick={() => copy(fullSha || sha)}
      className="inline-flex cursor-pointer items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground transition-colors select-none hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      title={`Copy commit SHA ${fullSha || sha}`}
      aria-label={`Copy commit SHA ${sha}`}
    >
      {isCopied ? (
        <>
          <CheckCircleIcon
            className="size-3 text-emerald-500"
            aria-hidden="true"
          />
          <span className="text-emerald-600 dark:text-emerald-400">
            Copied!
          </span>
        </>
      ) : (
        <>
          <GitCommitIcon
            className="size-3 text-muted-foreground"
            aria-hidden="true"
          />
          <span>{sha}</span>
        </>
      )}
      <span className="sr-only" aria-live="polite">
        {isCopied ? "Commit SHA copied to clipboard" : error || ""}
      </span>
    </button>
  )
}

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "Pending"
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    if (diffMinutes < 1) return "Just now"
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} hours ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} days ago`
  } catch {
    return dateString
  }
}

function DeploymentsPageContent({
  initialDeployments,
}: {
  initialDeployments?: Deployment[]
} = {}) {
  const { service, serviceId, updateServiceState, showToast } = useService()

  const [deployments, setDeployments] = React.useState<Deployment[]>(
    () => initialDeployments || []
  )
  const [isLoading, setIsLoading] = React.useState(() => !initialDeployments)
  const [error, setError] = React.useState<Error | null>(null)
  const [isDeploying, setIsDeploying] = React.useState(false)

  // Selected deployment for live log viewer modal
  const [selectedLogDeployment, setSelectedLogDeployment] =
    React.useState<Deployment | null>(null)

  // Selected deployment for rollback confirmation
  const [rollbackTarget, setRollbackTarget] = React.useState<Deployment | null>(
    null
  )
  const [isRollingBack, setIsRollingBack] = React.useState(false)

  // Sub-tab selection: history vs previews
  const [activeSubTab, setActiveSubTab] = React.useState<
    "history" | "previews"
  >("history")
  const [previews, setPreviews] = React.useState<PreviewEnvironment[]>([])
  const [isLoadingPreviews, setIsLoadingPreviews] = React.useState(false)
  const [previewToDelete, setPreviewToDelete] =
    React.useState<PreviewEnvironment | null>(null)
  const [isDeletingPreview, setIsDeletingPreview] = React.useState(false)

  const loadDeployments = React.useCallback(async () => {
    if (!serviceId) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.services.listDeployments(serviceId, {
        limit: 25,
      })
      setDeployments(response.items)
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to load deployment history.")
      )
    } finally {
      setIsLoading(false)
    }
  }, [serviceId])

  const loadPreviews = React.useCallback(async () => {
    if (!serviceId) return
    setIsLoadingPreviews(true)
    try {
      const items = await api.services.listPreviews(serviceId)
      setPreviews(items)
    } catch {
      // Ignore preview load error
    } finally {
      setIsLoadingPreviews(false)
    }
  }, [serviceId])

  React.useEffect(() => {
    loadDeployments()
    loadPreviews()
  }, [loadDeployments, loadPreviews])

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openLogParam = searchParams?.get("openLog")

  const [expandedDiffs, setExpandedDiffs] = React.useState<
    Record<string, boolean>
  >({})

  const toggleDiff = React.useCallback((id: string) => {
    setExpandedDiffs((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Auto-open live build log when requested via query param (e.g. from ActiveDeploymentBanner)
  React.useEffect(() => {
    if (!openLogParam || deployments.length === 0) return

    if (openLogParam === "active") {
      const active =
        deployments.find((d) => d.id === service?.active_deployment_id) ||
        deployments.find((d) =>
          ["queued", "building", "deploying"].includes(d.status)
        ) ||
        deployments[0]
      if (active) {
        setSelectedLogDeployment(active)
      }
    } else {
      const match = deployments.find((d) => d.id === openLogParam)
      if (match) {
        setSelectedLogDeployment(match)
      } else {
        api.services
          .getDeployment(serviceId, openLogParam)
          .then((dep) => setSelectedLogDeployment(dep))
          .catch(() => {})
      }
    }
  }, [openLogParam, deployments, service?.active_deployment_id, serviceId])

  const handleConfirmDeletePreview = async () => {
    if (!previewToDelete || !serviceId) return
    setIsDeletingPreview(true)
    try {
      await api.services.deletePreview(serviceId, previewToDelete.id)
      setPreviews((prev) => prev.filter((p) => p.id !== previewToDelete.id))
      showToast(
        "success",
        `Preview environment for PR #${previewToDelete.pr_number} destroyed.`
      )
      setPreviewToDelete(null)
    } catch {
      showToast("error", "Failed to destroy preview environment.")
    } finally {
      setIsDeletingPreview(false)
    }
  }

  const handleDeployBranch = async () => {
    setIsDeploying(true)
    try {
      const newDep = await api.services.createDeployment(serviceId, {
        branch: service?.branch || "main",
      })
      setDeployments((prev) => [newDep, ...prev])
      updateServiceState({
        status: "building",
        active_deployment_id: newDep.id,
      })
      showToast("success", `New build dispatched on branch "${newDep.branch}".`)
      // Open build log viewer immediately for feedback
      setSelectedLogDeployment(newDep)
    } catch {
      showToast("error", "Failed to dispatch deployment.")
    } finally {
      setIsDeploying(false)
    }
  }

  const handleConfirmRollback = async () => {
    if (!rollbackTarget) return
    setIsRollingBack(true)
    try {
      const rolledBack = await api.services.rollbackDeployment(
        serviceId,
        rollbackTarget.id
      )
      setDeployments((prev) => [rolledBack, ...prev])
      updateServiceState({
        status: "running",
        active_deployment_id: rolledBack.id,
      })
      showToast(
        "success",
        `Rolled back to deployment ${rollbackTarget.commit_sha.slice(0, 7)}.`
      )
      setRollbackTarget(null)
    } catch {
      showToast("error", "Failed to execute rollback.")
    } finally {
      setIsRollingBack(false)
    }
  }

  const handleDeploymentUpdated = React.useCallback(
    (updated: Deployment) => {
      setDeployments((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      )
      if (updated.id === service?.active_deployment_id) {
        const mappedServiceStatus =
          updated.status === "success"
            ? "running"
            : updated.status === "building"
              ? "building"
              : updated.status === "failed"
                ? "failed"
                : service.status
        updateServiceState({ status: mappedServiceStatus })
      }
    },
    [service?.active_deployment_id, service?.status, updateServiceState]
  )

  const activeDeploymentId = service?.active_deployment_id

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Sub-Tabs Navigation */}
      <div className="flex gap-6 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveSubTab("history")}
          className={cn(
            "-mb-px cursor-pointer border-b-2 pb-3 text-sm font-medium transition-colors",
            activeSubTab === "history"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          All Deployments
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSubTab("previews")
            loadPreviews()
          }}
          className={cn(
            "-mb-px flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors",
            activeSubTab === "previews"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Previews</span>
          {previews.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {previews.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === "history" ? (
        isLoading ? (
          <div className="flex flex-col gap-4">
            <LoadingSkeleton variant="table" rows={4} />
          </div>
        ) : error ? (
          <ErrorCard
            title="Failed to Load Deployments"
            message={error.message}
            onRetry={loadDeployments}
          />
        ) : (
          <>
            {/* Tab Header Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  Deployment History
                </h2>
                <p className="text-xs text-muted-foreground">
                  View build outputs, monitor rollouts, or revert to previous
                  verified images.
                </p>
              </div>

              <Button
                variant="default"
                onClick={handleDeployBranch}
                disabled={isDeploying}
                className="cursor-pointer gap-2"
              >
                {isDeploying ? (
                  <CircleNotchIcon
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <RocketLaunchIcon className="size-4" aria-hidden="true" />
                )}
                <span>Deploy Branch</span>
              </Button>
            </div>

            {/* Deployments List */}
            {deployments.length === 0 ? (
              <EmptyState
                title="No deployments found"
                description="This service has not been deployed yet. Trigger a manual build to deploy your first container."
                action={{
                  label: "Deploy Branch",
                  onClick: handleDeployBranch,
                }}
                icon={
                  <RocketLaunchIcon
                    className="size-6 text-muted-foreground"
                    aria-hidden="true"
                  />
                }
              />
            ) : (
              <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {deployments.map((deployment, index) => {
                  const previousDeployment = deployments[index + 1]
                  const envDiffs = computeEnvDiff(
                    deployment.env_snapshot,
                    previousDeployment?.env_snapshot
                  )
                  const isDiffExpanded = !!expandedDiffs[deployment.id]
                  const isActive = deployment.id === activeDeploymentId
                  const isSuccessful = deployment.status === "success"
                  const canRollback = !isActive && isSuccessful
                  const commitSha = deployment.commit_sha
                    ? deployment.commit_sha.slice(0, 7)
                    : "latest"

                  return (
                    <div key={deployment.id} className="flex flex-col">
                      <div className="flex flex-col justify-between gap-4 p-4 transition-colors hover:bg-muted/40 md:flex-row md:items-center">
                        {/* Left: Status badge, commit message, author, branch, SHA, Env Changes pill */}
                        <div className="flex items-start gap-3">
                          <div className="pt-0.5">
                            <StatusBadge
                              variant={deployment.status}
                              size="sm"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <CommitShaChip
                                sha={commitSha}
                                fullSha={deployment.commit_sha || undefined}
                              />

                              {isActive && (
                                <span className="inline-flex items-center gap-1 rounded border border-status-healthy-border bg-status-healthy-bg px-2 py-0.5 text-2xs leading-none font-semibold text-status-healthy-text uppercase">
                                  <CheckCircleIcon
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  <span>Active</span>
                                </span>
                              )}

                              <span className="text-sm font-medium text-foreground">
                                {deployment.commit_message || "Deploy commit"}
                              </span>

                              {envDiffs.length > 0 && (
                                <EnvDiffPill
                                  count={envDiffs.length}
                                  isExpanded={isDiffExpanded}
                                  onToggle={() => toggleDiff(deployment.id)}
                                  deploymentId={deployment.id}
                                />
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <GitBranchIcon
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                <span>{deployment.branch}</span>
                              </span>

                              {deployment.commit_author && (
                                <span className="inline-flex items-center gap-1">
                                  <UserIcon
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  <span>{deployment.commit_author}</span>
                                </span>
                              )}

                              <span className="inline-flex items-center gap-1">
                                <ClockIcon
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                <span>
                                  {formatRelativeTime(
                                    deployment.started_at ||
                                      deployment.created_at
                                  )}
                                </span>
                              </span>

                              {deployment.duration_seconds !== null &&
                                deployment.duration_seconds !== undefined && (
                                  <span>({deployment.duration_seconds}s)</span>
                                )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Actions (View Logs, Rollback) */}
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedLogDeployment(deployment)}
                            className="cursor-pointer gap-1.5"
                          >
                            <TerminalWindowIcon
                              className="size-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span>View Logs</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRollbackTarget(deployment)}
                            disabled={!canRollback}
                            title={
                              isActive
                                ? "Currently active deployment"
                                : !isSuccessful
                                  ? "Only successful deployments can be rolled back to"
                                  : "Reactivate this Docker image without rebuilding"
                            }
                            className="cursor-pointer gap-1.5 disabled:opacity-40"
                          >
                            <ArrowCounterClockwiseIcon
                              className="size-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span>Rollback</span>
                          </Button>
                        </div>
                      </div>

                      {/* Inline Diff Panel (reveals on toggle) */}
                      {isDiffExpanded && envDiffs.length > 0 && (
                        <EnvDiffPanel
                          diffs={envDiffs}
                          deploymentId={deployment.id}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )
      ) : (
        <>
          {/* Previews Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Pull Request Previews
              </h2>
              <p className="text-xs text-muted-foreground">
                Ephemeral environments provisioned automatically for GitHub pull
                requests with dedicated subdomains.
              </p>
            </div>
          </div>

          {/* Previews List */}
          {isLoadingPreviews ? (
            <LoadingSkeleton count={3} />
          ) : previews.length === 0 ? (
            <EmptyState
              title="No active preview environments"
              description="Ephemeral preview environments are created automatically when a Pull Request is opened in GitHub."
              icon={
                <GlobeIcon
                  className="size-6 text-muted-foreground"
                  aria-hidden="true"
                />
              }
            />
          ) : (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {previews.map((preview) => {
                const commitSha = preview.commit_sha
                  ? preview.commit_sha.slice(0, 7)
                  : "latest"

                return (
                  <div
                    key={preview.id}
                    className="flex flex-col justify-between gap-4 p-4 transition-colors hover:bg-muted/40 md:flex-row md:items-center"
                  >
                    {/* Left: Status badge, PR tag, name, branch, commit */}
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <StatusBadge
                          variant={
                            (preview.status as StatusVariant) || "healthy"
                          }
                          size="sm"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            PR #{preview.pr_number}
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {preview.name}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <GitBranchIcon
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            <span>{preview.branch}</span>
                          </div>

                          <CommitShaChip
                            sha={commitSha}
                            fullSha={preview.commit_sha || undefined}
                          />

                          <div className="flex items-center gap-1.5 font-sans">
                            <ClockIcon
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            <span>
                              {formatRelativeTime(
                                preview.updated_at || preview.created_at
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Direct preview URL button & Kill button */}
                    <div className="flex shrink-0 items-center gap-2">
                      {preview.url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(preview.url, "_blank")}
                          className="cursor-pointer gap-1.5 text-xs"
                        >
                          <span>Open Preview</span>
                          <ArrowSquareOutIcon
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewToDelete(preview)}
                        className="cursor-pointer gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <TrashIcon className="size-3.5" aria-hidden="true" />
                        <span>Destroy</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Live Build Log Streaming Modal */}
      <BuildLogModal
        serviceId={serviceId}
        deployment={selectedLogDeployment}
        open={selectedLogDeployment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLogDeployment(null)
            if (openLogParam) {
              router.replace(pathname)
            }
          }
        }}
        onDeploymentUpdated={handleDeploymentUpdated}
      />

      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={rollbackTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRollbackTarget(null)
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Confirm Instant Rollback</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Reactivate the verified image from deployment{" "}
              <span className="font-mono text-foreground">
                {rollbackTarget?.commit_sha.slice(0, 7)}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2 text-sm">
            <p className="text-muted-foreground">
              Traefik dynamic routing will switch incoming traffic to the cached
              Docker image tag:
            </p>
            <div className="flex items-center justify-between gap-2 truncate rounded-md border border-border bg-muted p-2.5 font-mono text-xs text-foreground">
              <span className="truncate">
                {rollbackTarget?.image_tag || "tako-app-image:cached"}
              </span>
              <CopyButton
                text={rollbackTarget?.image_tag || "tako-app-image:cached"}
                size="xs"
                showIconOnly
                aria-label="Copy image tag"
                title="Copy image tag"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Zero downtime is preserved. Health checks must pass before the
              current container is drained.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRollbackTarget(null)}
              disabled={isRollingBack}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmRollback}
              disabled={isRollingBack}
              className="cursor-pointer gap-1.5"
            >
              {isRollingBack ? (
                <CircleNotchIcon
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowCounterClockwiseIcon
                  className="size-4"
                  aria-hidden="true"
                />
              )}
              <span>Rollback Image</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Destroy Preview Confirmation Dialog */}
      <Dialog
        open={Boolean(previewToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingPreview) {
            setPreviewToDelete(null)
          }
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Destroy Preview Environment</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to destroy the preview environment for PR #
              {previewToDelete?.pr_number}? This will immediately stop the
              container, remove the Traefik proxy route, and delete the
              ephemeral service.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPreviewToDelete(null)}
              disabled={isDeletingPreview}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeletePreview}
              disabled={isDeletingPreview}
              className="cursor-pointer gap-1.5"
            >
              {isDeletingPreview ? (
                <CircleNotchIcon
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <TrashIcon className="size-4" aria-hidden="true" />
              )}
              <span>Destroy Preview</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ServiceDeploymentsPage({
  initialDeployments,
}: {
  initialDeployments?: Deployment[]
} = {}) {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <LoadingSkeleton variant="table" rows={4} />
        </div>
      }
    >
      <DeploymentsPageContent initialDeployments={initialDeployments} />
    </React.Suspense>
  )
}
