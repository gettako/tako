"use client"

import * as React from "react"
import { SettingsHeader } from "@/components/settings-header"
import { useSearchParams } from "next/navigation"
import {
  GithubLogoIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowsClockwiseIcon,
  GitBranchIcon,
  LockIcon,
  GlobeIcon,
  ArrowSquareOutIcon,
  MagnifyingGlassIcon,
  WarningCircleIcon,
  PlusIcon,
  TrashIcon,
  CircleNotchIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { LoadingSkeleton, ErrorCard } from "@/components/states"
import {
  api,
  type GitHubStatus,
  type GitHubRepo,
  type GitHubConnection,
  type CreateGitHubConnectionRequest,
  ApiError,
} from "@/lib/api"
import { cn } from "@/lib/utils"

export function WebhookConfigCard({
  payloadUrl = "https://gettako.dev/api/github/webhook",
  secret = "whsec_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d",
}: {
  payloadUrl?: string
  secret?: string
}) {
  const [showSecret, setShowSecret] = React.useState(false)

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Global Webhook Configuration
        </h2>
        <p className="text-xs text-muted-foreground">
          Configure this payload endpoint in your repository webhook settings to
          receive git push events.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-4 text-xs">
        {/* Payload URL */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-foreground">Payload URL</label>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center rounded-md border border-border bg-muted/50 px-3 py-2">
              <span className="font-mono text-xs text-foreground">
                {payloadUrl}
              </span>
            </div>
            <CopyButton
              text={payloadUrl}
              label="Copy"
              variant="outline"
              size="default"
              aria-label="Copy webhook payload URL"
              className="h-8 gap-1 px-2.5 text-xs"
            />
          </div>
        </div>

        {/* Webhook Secret */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-foreground">
            Webhook Secret (HMAC SHA-256)
          </label>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2">
              <span className="font-mono text-xs text-foreground">
                {showSecret ? secret : "whsec_••••••••••••••••••••••••••••••••"}
              </span>
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="ml-2 text-muted-foreground hover:text-foreground"
                aria-label={showSecret ? "Hide secret" : "Reveal secret"}
              >
                {showSecret ? (
                  <EyeSlashIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </div>
            <CopyButton
              text={secret}
              label="Copy"
              variant="outline"
              size="default"
              aria-label="Copy webhook secret"
              className="h-8 gap-1 px-2.5 text-xs"
            />
          </div>
        </div>

        {/* Webhook Content Type Guidance */}
        <div className="rounded-md border border-border bg-muted/30 p-3 text-2xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            Setup Instructions:{" "}
          </span>
          In GitHub, go to your repository Settings &gt; Webhooks &gt; Add
          webhook. Paste the Payload URL above, choose{" "}
          <code className="font-mono text-foreground">application/json</code> as
          content type, paste the secret, and select the{" "}
          <code className="font-mono text-foreground">Just the push event</code>{" "}
          trigger. Tako automatically multiplexes webhooks based on repository
          URL or connection-specific endpoints.
        </div>
      </div>
    </div>
  )
}

export function GitHubConnectionsCard({
  connections,
  isLoading,
  onRefresh,
}: {
  connections: GitHubConnection[]
  isLoading: boolean
  onRefresh: () => Promise<void>
}) {
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [authType, setAuthType] = React.useState<"pat" | "app">("pat")
  const [name, setName] = React.useState("")
  const [accountName, setAccountName] = React.useState("")
  const [token, setToken] = React.useState("")
  const [showToken, setShowToken] = React.useState(false)
  const [appId, setAppId] = React.useState("")
  const [installationId, setInstallationId] = React.useState("")
  const [privateKey, setPrivateKey] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] =
    React.useState<GitHubConnection | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const [isConnectingManifest, setIsConnectingManifest] = React.useState(false)
  const [manifestError, setManifestError] = React.useState<string | null>(null)
  const [isSyncingOrgs, setIsSyncingOrgs] = React.useState(false)

  const handleConnectManifest = async () => {
    setIsConnectingManifest(true)
    setManifestError(null)
    try {
      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : undefined
      const resp = await api.github.getManifest(origin ? { origin } : undefined)
      const form = document.createElement("form")
      form.method = "POST"
      form.action = resp.action_url
      form.target = "_self"

      const input = document.createElement("input")
      input.type = "hidden"
      input.name = "manifest"
      input.value = JSON.stringify(resp.manifest)
      form.appendChild(input)

      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      setIsConnectingManifest(false)
      if (err instanceof ApiError) {
        setManifestError(err.message)
      } else if (err instanceof Error) {
        setManifestError(err.message)
      } else {
        setManifestError("Failed to initiate GitHub App creation.")
      }
    }
  }

  const handleSyncOrganizations = async () => {
    setIsSyncingOrgs(true)
    try {
      await api.github.syncInstallations()
      await onRefresh()
    } catch (err) {
      if (err instanceof Error) {
        setManifestError(err.message)
      }
    } finally {
      setIsSyncingOrgs(false)
    }
  }

  const resetForm = () => {
    setName("")
    setAccountName("")
    setToken("")
    setShowToken(false)
    setAppId("")
    setInstallationId("")
    setPrivateKey("")
    setFormError(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setIsAddOpen(true)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError("Connection name is required.")
      return
    }

    if (authType === "pat" && !token.trim()) {
      setFormError("Personal Access Token is required.")
      return
    }

    if (authType === "app") {
      if (!appId.trim()) {
        setFormError("GitHub App ID is required.")
        return
      }
      if (!installationId.trim()) {
        setFormError("Installation ID is required.")
        return
      }
      if (!privateKey.trim()) {
        setFormError("Private Key is required.")
        return
      }
    }

    setIsSubmitting(true)
    try {
      const payload: CreateGitHubConnectionRequest = {
        name: name.trim(),
        auth_type: authType,
        account_name: accountName.trim() || undefined,
        ...(authType === "pat" ? { token: token.trim() } : {}),
        ...(authType === "app"
          ? {
              app_id: appId.trim(),
              installation_id: installationId.trim(),
              private_key: privateKey.trim(),
            }
          : {}),
      }
      await api.github.createConnection(payload)
      setIsAddOpen(false)
      resetForm()
      await onRefresh()
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message)
      } else if (err instanceof Error) {
        setFormError(err.message)
      } else {
        setFormError("Failed to add GitHub connection.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)

    try {
      await api.github.deleteConnection(deleteTarget.id)
      setDeleteTarget(null)
      await onRefresh()
    } catch (err) {
      if (err instanceof ApiError) {
        setDeleteError(err.message)
      } else if (err instanceof Error) {
        setDeleteError(err.message)
      } else {
        setDeleteError("Failed to delete GitHub connection.")
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const manifestAppConnection = connections.find(
    (c) => c.auth_type === "app" && Boolean(c.app_slug)
  )

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">
            GitHub Connections
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage multiple GitHub accounts or organizations for repository
            access and multiplexed webhooks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenAdd}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <PlusIcon className="size-3.5" />
            <span>Add Connection</span>
          </Button>
        </div>
      </div>

      {/* 1-Click Setup or Active App Banner */}
      {manifestAppConnection ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                <GithubLogoIcon className="size-5 text-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    @{manifestAppConnection.app_slug}
                  </h3>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-2xs font-medium text-emerald-500">
                    Active GitHub App
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  1-Click integration active. Multi-organization access enabled.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSyncOrganizations}
                disabled={isSyncingOrgs}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                {isSyncingOrgs ? (
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                ) : (
                  <ArrowsClockwiseIcon className="size-3.5" />
                )}
                <span>Sync Organizations</span>
              </Button>
              <a
                href={`https://github.com/apps/${manifestAppConnection.app_slug}/installations/new`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <PlusIcon className="size-3.5" />
                <span>Install on another Org</span>
                <ArrowSquareOutIcon className="size-3" />
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                <GithubLogoIcon className="size-5 text-foreground" />
              </div>
              <div>
                <h3 className="font-heading text-sm font-semibold text-foreground">
                  Connect GitHub (1-Click Automatic Setup)
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Recommended for personal accounts and organizations.
                  Automatically configures permissions, keys, and webhooks with
                  1 click.
                </p>
                {manifestError && (
                  <p className="mt-1.5 text-xs font-medium text-destructive">
                    {manifestError}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleConnectManifest}
              disabled={isConnectingManifest}
              className="h-8 shrink-0 gap-1.5 px-3 text-xs font-medium"
            >
              {isConnectingManifest ? (
                <CircleNotchIcon className="size-3.5 animate-spin" />
              ) : (
                <GithubLogoIcon className="size-3.5" />
              )}
              <span>Create &amp; Connect GitHub App</span>
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 flex flex-col gap-3">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      ) : connections.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-md border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
          <GithubLogoIcon className="size-8 text-muted-foreground/60" />
          <p className="mt-2 font-medium text-foreground">
            No GitHub connections configured
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Use 1-Click setup above or add a connection manually to deploy
            repositories.
          </p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {connections.map((conn) => {
            const serviceCount = conn.service_count ?? 0
            const hasActiveServices = serviceCount > 0
            const webhookUrl = `https://gettako.dev/api/github/webhook/${conn.id}`

            return (
              <div
                key={conn.id}
                className="flex flex-col gap-3 py-4 text-xs first:pt-2 last:pb-0"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {conn.avatar_url ? (
                      <img
                        src={conn.avatar_url}
                        alt={conn.name}
                        className="size-8 rounded-full border border-border"
                      />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-full border border-border bg-muted text-foreground">
                        <GithubLogoIcon className="size-4" />
                      </div>
                    )}

                    <div className="flex flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {conn.name}
                        </span>
                        {conn.account_name && (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                            {`@${conn.account_name}`}
                          </span>
                        )}
                        <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-2xs font-medium text-foreground">
                          {conn.auth_type === "pat" ? "PAT" : "GitHub App"}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-2xs font-medium",
                            hasActiveServices
                              ? "border border-primary/30 bg-primary/10 text-primary"
                              : "border border-border bg-muted/30 text-muted-foreground"
                          )}
                        >
                          {`${serviceCount} active service${serviceCount === 1 ? "" : "s"}`}
                        </span>
                      </div>
                      <span className="mt-0.5 text-2xs text-muted-foreground">
                        ID: <code className="font-mono">{conn.id}</code>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleteTarget(conn)
                      }}
                      className="h-7 gap-1 border-destructive/30 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                      aria-label={`Delete connection ${conn.name}`}
                    >
                      <TrashIcon className="size-3.5" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>

                {/* Connection-specific Webhook Endpoint */}
                <div className="flex flex-col gap-1 rounded-md border border-border/80 bg-muted/30 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-2xs font-medium text-foreground">
                      Multiplexed Webhook URL:
                    </span>
                    <span className="font-mono text-2xs break-all text-muted-foreground">
                      {webhookUrl}
                    </span>
                  </div>
                  <CopyButton
                    text={webhookUrl}
                    label="Copy Webhook URL"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1 px-2.5 text-2xs"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Connection Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Add GitHub Connection</DialogTitle>
            <DialogDescription>
              Connect a GitHub account using a Personal Access Token or a GitHub
              App to enable automated builds and webhook triggers.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleAddSubmit}
            className="flex flex-col gap-4 text-xs"
          >
            {formError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <WarningCircleIcon className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Connection Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="conn-name"
                className="font-medium text-foreground"
              >
                Connection Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="conn-name"
                placeholder="e.g. Acme Organization or Personal Projects"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Auth Type Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-foreground">
                Authentication Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthType("pat")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                    authType === "pat"
                      ? "border-foreground bg-muted font-medium"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <span className="text-xs font-semibold text-foreground">
                    Personal Access Token (PAT)
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    Classic token or fine-grained GitHub token
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthType("app")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                    authType === "app"
                      ? "border-foreground bg-muted font-medium"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <span className="text-xs font-semibold text-foreground">
                    GitHub App
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    Private key with App &amp; Installation ID
                  </span>
                </button>
              </div>
            </div>

            {/* Account / Org Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="conn-account"
                className="font-medium text-foreground"
              >
                GitHub Username or Organization
              </label>
              <Input
                id="conn-account"
                placeholder="e.g. octocat or acme-corp"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>

            {/* PAT Fields */}
            {authType === "pat" ? (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="conn-token"
                  className="font-medium text-foreground"
                >
                  Personal Access Token{" "}
                  <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="conn-token"
                    type={showToken ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showToken ? "Hide token" : "Reveal token"}
                  >
                    {showToken ? (
                      <EyeSlashIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
                <p className="text-2xs text-muted-foreground">
                  Token requires repository read and webhook write permissions.
                  Stored encrypted at rest using AES-256-GCM.
                </p>
              </div>
            ) : (
              /* GitHub App Fields */
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="conn-app-id"
                      className="font-medium text-foreground"
                    >
                      App ID <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="conn-app-id"
                      placeholder="e.g. 123456"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="conn-inst-id"
                      className="font-medium text-foreground"
                    >
                      Installation ID{" "}
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="conn-inst-id"
                      placeholder="e.g. 789012"
                      value={installationId}
                      onChange={(e) => setInstallationId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="conn-privkey"
                    className="font-medium text-foreground"
                  >
                    Private Key (PEM format){" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="conn-privkey"
                    rows={4}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    className="w-full rounded-md border border-border bg-transparent p-2.5 font-mono text-2xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  />
                  <p className="text-2xs text-muted-foreground">
                    Encrypted at rest using AES-256-GCM authenticated
                    encryption.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                disabled={isSubmitting}
                className="h-8 px-3 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8 px-3 text-xs"
              >
                {isSubmitting ? "Adding Connection..." : "Add Connection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Connection Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Delete GitHub Connection</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this GitHub connection?
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="flex flex-col gap-4 text-xs">
              {deleteError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">
                      Cannot delete connection
                    </span>
                    <span>{deleteError}</span>
                  </div>
                </div>
              )}

              {(deleteTarget.service_count ?? 0) > 0 && !deleteError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
                >
                  <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">
                      Active Services Warning
                    </span>
                    <span>
                      {`This connection is currently linked to ${deleteTarget.service_count ?? 0} active service${(deleteTarget.service_count ?? 0) === 1 ? "" : "s"}. You must reassign or remove these services before deleting this connection.`}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-muted-foreground">
                Connection name:{" "}
                <strong className="text-foreground">{deleteTarget.name}</strong>{" "}
                (
                {deleteTarget.auth_type === "pat"
                  ? "Personal Access Token"
                  : "GitHub App"}
                ).
              </p>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeleteTarget(null)
                    setDeleteError(null)
                  }}
                  disabled={isDeleting}
                  className="h-8 px-3 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting || (deleteTarget.service_count ?? 0) > 0}
                  className="h-8 px-3 text-xs"
                >
                  {isDeleting ? "Deleting..." : "Delete Connection"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function SyncedReposCard({
  repos,
  isSyncing,
  onSync,
}: {
  repos: GitHubRepo[]
  isSyncing: boolean
  onSync: () => Promise<void>
}) {
  const [repoSearch, setRepoSearch] = React.useState("")

  const filteredRepos = React.useMemo(() => {
    if (!repoSearch.trim()) return repos
    const q = repoSearch.toLowerCase().trim()
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        r.default_branch.toLowerCase().includes(q)
    )
  }, [repos, repoSearch])

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">
            Synced Repositories
          </h2>
          <p className="text-xs text-muted-foreground">
            Repositories accessible by Tako for service deployment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <ArrowsClockwiseIcon
              className={cn("size-3.5", isSyncing && "animate-spin")}
            />
            <span>Sync Repositories Now</span>
          </Button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative mt-4 max-w-sm">
        <MagnifyingGlassIcon className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search synced repositories..."
          value={repoSearch}
          onChange={(e) => setRepoSearch(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Repositories List */}
      {filteredRepos.length > 0 ? (
        <div className="mt-4 divide-y divide-border">
          {filteredRepos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between py-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-7 items-center justify-center rounded border border-border bg-muted text-foreground">
                  {repo.private ? (
                    <LockIcon className="size-3.5 text-muted-foreground" />
                  ) : (
                    <GlobeIcon className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {repo.full_name}
                  </span>
                  <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <GitBranchIcon className="size-3" />
                      {repo.default_branch}
                    </span>
                    <span>•</span>
                    <span>{repo.private ? "Private" : "Public"}</span>
                  </div>
                </div>
              </div>

              <a
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="hidden sm:inline">View on GitHub</span>
                <ArrowSquareOutIcon className="size-3.5" />
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center py-6 text-center text-xs text-muted-foreground">
          <GithubLogoIcon className="size-8 text-muted-foreground/60" />
          <p className="mt-2 font-medium text-foreground">
            No repositories match your filter
          </p>
          <p className="mt-0.5">
            Try another search query or sync repositories.
          </p>
        </div>
      )}
    </div>
  )
}

function GitHubSettingsContent() {
  const searchParams = useSearchParams()
  const setupAction = searchParams.get("setup_action")
  const installationId = searchParams.get("installation_id")
  const [installSuccessNotice, setInstallSuccessNotice] = React.useState<
    string | null
  >(null)

  const [connections, setConnections] = React.useState<GitHubConnection[]>([])
  const [repos, setRepos] = React.useState<GitHubRepo[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const handledSetupRef = React.useRef(false)

  const loadGitHubData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [connectionsData, reposData] = await Promise.all([
        api.github.listConnections().catch(() => []),
        api.github.listRepos().catch(() => []),
      ])
      setConnections(connectionsData)
      setRepos(reposData)
    } catch (err) {
      if (err instanceof Error) {
        setError(err)
      } else {
        setError(new Error("Failed to load GitHub integration data."))
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadGitHubData()
  }, [loadGitHubData])

  React.useEffect(() => {
    if (handledSetupRef.current) return
    if (setupAction === "install" || installationId) {
      handledSetupRef.current = true
      setInstallSuccessNotice(
        "GitHub App connected! Synchronizing organization installations..."
      )
      api.github
        .syncInstallations()
        .then(() => {
          setInstallSuccessNotice(
            "GitHub App successfully connected and organization installations synchronized."
          )
          return loadGitHubData()
        })
        .catch(() => {
          setInstallSuccessNotice(
            "GitHub App connected. Syncing installations..."
          )
          return loadGitHubData()
        })
        .finally(() => {
          if (typeof window !== "undefined") {
            window.history.replaceState({}, "", "/settings/github")
          }
        })
    }
  }, [setupAction, installationId, loadGitHubData])

  const handleSyncRepos = React.useCallback(async () => {
    setIsSyncing(true)
    try {
      const reposData = await api.github.listRepos()
      setRepos(reposData)
    } catch {
      // Keep existing repos
    } finally {
      setIsSyncing(false)
    }
  }, [])

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <SettingsHeader
        title="GitHub Integration"
        description="Manage repository access, webhook delivery, and automatic deployments."
        action={
          <Button
            variant="outline"
            onClick={handleSyncRepos}
            disabled={isSyncing}
            className="gap-2 text-sm font-medium"
          >
            <ArrowsClockwiseIcon
              className={cn("size-4", isSyncing && "animate-spin")}
            />
            <span>Sync Repositories</span>
          </Button>
        }
      />

      {installSuccessNotice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-foreground">
          <div className="flex items-center gap-2.5">
            <CheckCircleIcon className="size-4 shrink-0 text-emerald-500" />
            <span className="font-medium">{installSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setInstallSuccessNotice(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-6">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      ) : error ? (
        <ErrorCard
          error={error}
          title="GitHub Integration Error"
          onRetry={loadGitHubData}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Card 1: Multi-account GitHub Connections */}
          <GitHubConnectionsCard
            connections={connections}
            isLoading={isLoading}
            onRefresh={loadGitHubData}
          />

          {/* Card 2: Webhook Information */}
          <WebhookConfigCard />

          {/* Card 3: Synced Repositories */}
          <SyncedReposCard
            repos={repos}
            isSyncing={isSyncing}
            onSync={handleSyncRepos}
          />
        </div>
      )}
    </div>
  )
}

export default function GitHubSettingsPage() {
  return (
    <React.Suspense fallback={<LoadingSkeleton variant="card" />}>
      <GitHubSettingsContent />
    </React.Suspense>
  )
}
