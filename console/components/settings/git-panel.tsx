"use client"

import * as React from "react"
import {
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react"

import {
  GitConnectModal,
  GitHubIcon,
} from "@/components/settings/git-connect-modal"
import { SettingsSectionHeader } from "@/components/settings/settings-section-header"
import { SyncedReposTable } from "@/components/settings/synced-repos-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"
import { type GitProviderConfig } from "@/types/platform"

export function GitPanel() {
  const {
    gitProviders,
    syncedRepos,
    syncGitRepos,
    toggleRepoAutoDeploy,
    disconnectGitProvider,
    completeGitHubAppSetup,
  } = usePlatformData()

  const [connectModalOpen, setConnectModalOpen] = React.useState(false)
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [syncedSuccess, setSyncedSuccess] = React.useState(false)

  // Notification banners
  const [setupSuccessMessage, setSetupSuccessMessage] = React.useState<
    string | null
  >(null)
  const [setupErrorMessage, setSetupErrorMessage] = React.useState<
    string | null
  >(null)
  const [isProcessingCode, setIsProcessingCode] = React.useState(false)

  const [providerToDisconnect, setProviderToDisconnect] =
    React.useState<GitProviderConfig | null>(null)

  const hasConnectedProviders = gitProviders.some((prov) => prov.connected)
  const primaryAppProvider = gitProviders.find(
    (prov) =>
      prov.connected &&
      (prov.connectionType === "app" || prov.id.startsWith("git-gh-"))
  )

  // Handle GitHub App redirect with code parameter or setup_action/installation_id
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const setup = params.get("setup")
    const setupAction = params.get("setup_action")
    const installationId = params.get("installation_id")

    if (setupAction === "installed" || installationId) {
      syncGitRepos()
        .then(() => {
          setSetupSuccessMessage(
            "GitHub App installed successfully! Repositories have been synchronized."
          )
          const url = new URL(window.location.href)
          url.searchParams.delete("setup_action")
          url.searchParams.delete("installation_id")
          window.history.replaceState({}, "", url.toString())
        })
        .catch(() => {})
      return
    }

    if (
      code &&
      (setup === "github" || window.location.search.includes("setup="))
    ) {
      const timer = setTimeout(() => {
        setIsProcessingCode(true)
        completeGitHubAppSetup(code)
          .then((app: any) => {
            const installUrl = app?.installUrl
            setSetupSuccessMessage(
              "GitHub App configured successfully! Next step: install it to your account or organization."
            )
            const url = new URL(window.location.href)
            url.searchParams.delete("code")
            url.searchParams.delete("setup")
            url.searchParams.delete("state")
            window.history.replaceState({}, "", url.toString())
            if (installUrl) {
              window.open(installUrl, "_blank")
            }
          })
          .catch((err: unknown) => {
            setSetupErrorMessage(
              err instanceof Error
                ? err.message
                : "Failed to exchange GitHub App authorization code."
            )
          })
          .finally(() => {
            setIsProcessingCode(false)
          })
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [completeGitHubAppSetup, syncGitRepos])

  // Auto-sync when window regains focus (e.g., returning from GitHub App installation in another tab)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const onFocus = () => {
      if (hasConnectedProviders) {
        void syncGitRepos()
      }
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [hasConnectedProviders, syncGitRepos])

  const handleTriggerSync = async () => {
    if (!hasConnectedProviders) return
    setIsSyncing(true)
    try {
      await syncGitRepos()
      setSyncedSuccess(true)
      setTimeout(() => setSyncedSuccess(false), 2000)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* GitHub App setup feedback alerts */}
      {isProcessingCode && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3.5 text-xs text-primary">
          <RefreshCw className="size-4 shrink-0 animate-spin" />
          <span>
            Finalizing GitHub App registration and exchanging manifest
            credentials...
          </span>
        </div>
      )}

      {setupSuccessMessage && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{setupSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSetupSuccessMessage(null)}
            className="text-[11px] font-medium hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {setupErrorMessage && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{setupErrorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSetupErrorMessage(null)}
            className="text-[11px] font-medium hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Connected Git Providers */}
      <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={FolderGit2}
          title="Git Providers & Continuous Integration"
          description="Connect GitHub Apps or Personal Access Tokens to automatically trigger container builds on code push."
          action={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTriggerSync}
                disabled={isSyncing || !hasConnectedProviders}
                title={
                  !hasConnectedProviders
                    ? "Connect a Git provider first to sync repositories"
                    : undefined
                }
                className={cn(
                  "gap-1.5 text-xs",
                  !hasConnectedProviders && "cursor-not-allowed opacity-50"
                )}
              >
                <RefreshCw
                  className={cn("size-3", isSyncing && "animate-spin")}
                />
                <span>
                  {isSyncing
                    ? "Syncing..."
                    : syncedSuccess
                      ? "Synced!"
                      : "Sync Repos"}
                </span>
              </Button>
              {primaryAppProvider && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      primaryAppProvider.installUrl ||
                        `https://github.com/apps/${primaryAppProvider.appSlug || "tako"}/installations/new`,
                      "_blank"
                    )
                  }
                  className="gap-1.5 text-xs"
                  title="Install this GitHub App to another account or organization"
                >
                  <Plus className="size-3.5" />
                  <span>Add Account / Org</span>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => setConnectModalOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Plus className="size-3.5" />
                <span>Connect Provider</span>
              </Button>
            </div>
          }
        />

        {/* Providers Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {gitProviders.map((prov) => (
            <div
              key={prov.id}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/10 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                  <GitHubIcon className="size-5 text-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {prov.name}
                    </span>
                    {prov.connected ? (
                      <span className="py-0.2 inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 font-mono text-[10px] text-emerald-500">
                        <CheckCircle2 className="size-2.5" />
                        <span>Connected</span>
                      </span>
                    ) : (
                      <span className="py-0.2 rounded bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                        Disconnected
                      </span>
                    )}
                  </div>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    Account: @{prov.username} • via{" "}
                    {prov.connectionType.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {prov.connected &&
                  (prov.connectionType === "app" ||
                    prov.id.startsWith("git-gh-")) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        const linkedRepo = syncedRepos.find((r) =>
                          r.fullName
                            .toLowerCase()
                            .startsWith(prov.username.toLowerCase() + "/")
                        )
                        const installId =
                          prov.installationId || linkedRepo?.installationId
                        const accType =
                          prov.accountType ||
                          linkedRepo?.accountType ||
                          "Organization"

                        const configUrl =
                          installId && installId > 0
                            ? accType.toLowerCase() === "organization"
                              ? `https://github.com/organizations/${prov.username}/settings/installations/${installId}`
                              : `https://github.com/settings/installations/${installId}`
                            : prov.installUrl ||
                              `https://github.com/apps/${prov.appSlug || "tako"}/installations/new`
                        window.open(configUrl, "_blank")
                      }}
                      className="gap-1 text-[11px]"
                      title={`Configure repositories for ${prov.username} on GitHub`}
                    >
                      <ExternalLink className="size-3" />
                      <span>Configure on GitHub</span>
                    </Button>
                  )}
                {prov.connected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setProviderToDisconnect(prov)}
                    className="text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reminder banner if app is connected but 0 repos synced */}
      {hasConnectedProviders && syncedRepos.length === 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0" />
            <span>
              GitHub App is connected, but no repositories are accessible yet.
              Install the App on your GitHub organization or account to choose
              which repositories to sync.
            </span>
          </div>
          {primaryAppProvider && (
            <Button
              type="button"
              size="xs"
              onClick={() =>
                window.open(
                  primaryAppProvider.installUrl ||
                    `https://github.com/apps/${primaryAppProvider.appSlug || "tako"}/installations/new`,
                  "_blank"
                )
              }
              className="shrink-0 gap-1 text-xs"
            >
              <span>Install on GitHub</span>
              <ExternalLink className="size-3" />
            </Button>
          )}
        </div>
      )}

      {/* 2. Synced Repositories Section */}
      <SyncedReposTable
        repos={syncedRepos}
        onToggleAutoDeploy={toggleRepoAutoDeploy}
      />

      {/* Connect Git Provider Dialog */}
      <GitConnectModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        onSuccess={setSetupSuccessMessage}
        onError={setSetupErrorMessage}
      />

      {/* Disconnect Provider Confirmation Dialog */}
      <Dialog
        open={!!providerToDisconnect}
        onOpenChange={(open) => !open && setProviderToDisconnect(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Disconnect Git Provider?</span>
            </DialogTitle>
            <DialogDescription className="pt-1 text-xs leading-relaxed">
              Revoking access to &ldquo;{providerToDisconnect?.name}&rdquo; will
              stop automated push-to-deploy webhooks. Active running services
              will remain unaffected.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setProviderToDisconnect(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (providerToDisconnect) {
                  disconnectGitProvider(providerToDisconnect.id)
                  setProviderToDisconnect(null)
                }
              }}
              className="gap-1.5 text-xs"
            >
              <Trash2 className="size-3.5" />
              <span>Disconnect</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
