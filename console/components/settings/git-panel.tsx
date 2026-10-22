"use client"

import * as React from "react"
import {
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Key,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react"
import { z } from "zod"

import { SettingsSectionHeader } from "@/components/settings/settings-section-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  SelectOption,
} from "@/components/ui/searchable-select"
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { cn } from "@/lib/utils"
import { GitProviderConfig } from "@/types/platform"

const gitConnectionSchema = z
  .object({
    connectTab: z.enum(["app", "pat"]),
    appName: z.string().trim(),
    targetOrg: z.string().trim(),
    patProvider: z.enum(["github", "gitlab", "gitea"]),
    patUsername: z.string().trim(),
    patToken: z.string(),
  })
  .superRefine((values, context) => {
    if (values.connectTab === "app") {
      if (!values.appName) {
        context.addIssue({
          code: "custom",
          path: ["appName"],
          message: "GitHub App display name is required.",
        })
      }
      if (!values.targetOrg) {
        context.addIssue({
          code: "custom",
          path: ["targetOrg"],
          message: "Target organization or account is required.",
        })
      }
      return
    }

    if (!values.patUsername) {
      context.addIssue({
        code: "custom",
        path: ["patUsername"],
        message: "Username or organization is required.",
      })
    }
    if (!values.patToken) {
      context.addIssue({
        code: "custom",
        path: ["patToken"],
        message: "Personal access token is required.",
      })
    }
  })

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
}

export function GitPanel() {
  const {
    gitProviders,
    syncedRepos,
    syncGitRepos,
    toggleRepoAutoDeploy,
    disconnectGitProvider,
    connectGitProvider,
    startGitHubAppSetup,
    completeGitHubAppSetup,
  } = usePlatformData()

  const [connectModalOpen, setConnectModalOpen] = React.useState(false)
  const [connectTab, setConnectTab] = React.useState<"app" | "pat">("app")
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [syncedSuccess, setSyncedSuccess] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedOrg, setSelectedOrg] = React.useState("all")

  // Notification banners
  const [setupSuccessMessage, setSetupSuccessMessage] = React.useState<
    string | null
  >(null)
  const [setupErrorMessage, setSetupErrorMessage] = React.useState<
    string | null
  >(null)
  const [isProcessingCode, setIsProcessingCode] = React.useState(false)

  // Handle GitHub App redirect with code parameter
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const setup = params.get("setup")
    if (code && (setup === "github" || window.location.search.includes("setup="))) {
      const timer = setTimeout(() => {
        setIsProcessingCode(true)
        completeGitHubAppSetup(code)
          .then(() => {
            setSetupSuccessMessage(
            "GitHub App configured, verified, and authenticated successfully!"
          )
          const url = new URL(window.location.href)
          url.searchParams.delete("code")
          url.searchParams.delete("setup")
          url.searchParams.delete("state")
          window.history.replaceState({}, "", url.toString())
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
  }, [completeGitHubAppSetup])

  // GitHub App Form
  const [appName, setAppName] = React.useState("Tako Edge Deployer")
  const [targetOrg, setTargetOrg] = React.useState("gettako")

  // PAT Form
  const [patProvider, setPatProvider] = React.useState<
    "github" | "gitlab" | "gitea"
  >("github")
  const [patUsername, setPatUsername] = React.useState("")
  const [patToken, setPatToken] = React.useState("")
  const [isConnecting, setIsConnecting] = React.useState(false)
  const { errors, validate, clearError } = useZodForm(gitConnectionSchema)

  const [providerToDisconnect, setProviderToDisconnect] =
    React.useState<GitProviderConfig | null>(null)

  const handleTriggerSync = async () => {
    setIsSyncing(true)
    try {
      await syncGitRepos()
      setSyncedSuccess(true)
      setTimeout(() => setSyncedSuccess(false), 2000)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({
      connectTab,
      appName,
      targetOrg,
      patProvider,
      patUsername,
      patToken,
    })
    if (!valid) return

    setIsConnecting(true)
    try {
      if (connectTab === "app") {
        await connectGitProvider({
          type: "github",
          name: appName.trim() || "GitHub App",
          username: targetOrg.trim() || "gettako",
          connected: true,
          connectionType: "app",
        })
      } else {
        await connectGitProvider({
          type: patProvider,
          name: `${patProvider.toUpperCase()} (${patUsername.trim()})`,
          username: patUsername.trim(),
          token: patToken,
          connected: true,
          connectionType: "pat",
        })
      }
      setSetupSuccessMessage(
        connectTab === "app"
          ? "GitHub App integration registered successfully."
          : `${patProvider.toUpperCase()} personal access token connected successfully.`
      )
      setConnectModalOpen(false)
    } catch (err: unknown) {
      setSetupErrorMessage(
        err instanceof Error ? err.message : "Failed to connect Git provider."
      )
    } finally {
      setIsConnecting(false)
    }
  }

  // Filter organizations from repos
  const orgs = React.useMemo(() => {
    const set = new Set<string>()
    syncedRepos.forEach((r) => {
      const parts = r.fullName.split("/")
      if (parts[0]) set.add(parts[0])
    })
    return Array.from(set)
  }, [syncedRepos])

  const orgOptions: SelectOption[] = React.useMemo(() => {
    return [
      {
        value: "all",
        label: "All Orgs",
        description: "All connected repository organizations",
      },
      ...orgs.map((org) => ({
        value: org,
        label: org,
        description: `Repositories belonging to ${org}`,
      })),
    ]
  }, [orgs])

  const filteredRepos = React.useMemo(() => {
    return syncedRepos.filter((repo) => {
      const matchesSearch =
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesOrg =
        selectedOrg === "all" || repo.fullName.startsWith(`${selectedOrg}/`)
      return matchesSearch && matchesOrg
    })
  }, [syncedRepos, searchQuery, selectedOrg])

  return (
    <div className="space-y-6">
      {/* GitHub App setup feedback alerts */}
      {isProcessingCode && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3.5 text-xs text-primary">
          <RefreshCw className="size-4 animate-spin shrink-0" />
          <span>Finalizing GitHub App registration and exchanging manifest credentials...</span>
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
                disabled={isSyncing}
                className="gap-1.5 text-xs"
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
          ))}
        </div>
      </div>

      {/* 2. Synced Repositories Section */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold text-foreground sm:text-sm">
              Synced Repositories ({filteredRepos.length})
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Repositories synchronized from connected Git integrations
              available for service deployments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input using shadcn Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-44 rounded-md pr-3 pl-8 text-xs sm:w-56"
              />
            </div>

            {/* Org Filter using SearchableSelect */}
            {orgs.length > 1 && (
              <SearchableSelect
                size="sm"
                className="w-40"
                value={selectedOrg}
                onChange={(val) => setSelectedOrg(val)}
                options={orgOptions}
                placeholder="Filter org..."
                searchPlaceholder="Search organizations..."
              />
            )}
          </div>
        </div>

        {/* Repositories Table */}
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Repository</th>
                  <th className="px-4 py-2.5 font-semibold">Visibility</th>
                  <th className="px-4 py-2.5 font-semibold">Default Branch</th>
                  <th className="px-4 py-2.5 font-semibold">Last Synced</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Auto Deploy on Push
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {filteredRepos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center font-sans text-xs text-muted-foreground"
                    >
                      No repositories match your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredRepos.map((repo) => (
                    <tr
                      key={repo.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 transition-colors hover:text-primary"
                        >
                          <GitHubIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span>{repo.fullName}</span>
                          <ExternalLink className="size-3 text-muted-foreground/60" />
                        </a>
                      </td>

                      <td className="px-4 py-3">
                        {repo.isPrivate ? (
                          <span className="inline-flex items-center gap-1 rounded border border-border/50 bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            <Lock className="size-2.5" />
                            <span>Private</span>
                          </span>
                        ) : (
                          <span className="rounded border border-border/50 bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            Public
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <GitBranch className="size-3 text-muted-foreground" />
                          <span>{repo.defaultBranch}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 text-[11px] text-muted-foreground">
                        {repo.updatedAt}
                      </td>

                      <td
                        className="px-4 py-3 text-right"
                        aria-label="Auto Deploy on Push"
                      >
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <span className="font-sans text-[11px] text-muted-foreground">
                            {repo.autoDeploy ? "Enabled" : "Disabled"}
                          </span>
                          <input
                            type="checkbox"
                            aria-label={`Toggle auto deploy for ${repo.name}`}
                            checked={repo.autoDeploy}
                            onChange={() => toggleRepoAutoDeploy(repo.id)}
                            className="size-3.5 cursor-pointer rounded accent-primary"
                          />
                        </label>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Connect Git Provider Dialog */}
      <Dialog open={connectModalOpen} onOpenChange={setConnectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderGit2 className="size-4 shrink-0 text-primary" />
              <span>Connect Git Provider</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Link repositories for automated push-to-deploy pipelines and
              branch builds.
            </DialogDescription>
          </DialogHeader>

          {/* Tab Navigation */}
          <div className="flex border-b border-border text-xs font-medium">
            <button
              type="button"
              onClick={() => setConnectTab("app")}
              className={cn(
                "border-b-2 px-3 py-2 transition-colors",
                connectTab === "app"
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              GitHub App (Recommended)
            </button>
            <button
              type="button"
              onClick={() => setConnectTab("pat")}
              className={cn(
                "border-b-2 px-3 py-2 transition-colors",
                connectTab === "pat"
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Personal Access Token
            </button>
          </div>

          <form
            onSubmit={handleConnectSubmit}
            noValidate
            className="space-y-4 pt-2"
          >
            {connectTab === "app" ? (
              <FieldGroup className="gap-3">
                <Field data-invalid={Boolean(errors.appName)}>
                  <FieldLabel className="text-xs">
                    GitHub App Display Name
                  </FieldLabel>
                  <Input
                    value={appName}
                    onChange={(e) => {
                      setAppName(e.target.value)
                      clearError("appName")
                    }}
                    aria-invalid={Boolean(errors.appName)}
                    aria-describedby={
                      errors.appName ? "git-app-name-error" : undefined
                    }
                    className="text-xs"
                  />
                  <FieldError id="git-app-name-error" className="text-[11px]">
                    {errors.appName}
                  </FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.targetOrg)}>
                  <FieldLabel className="text-xs">
                    Target Organization / Account
                  </FieldLabel>
                  <Input
                    value={targetOrg}
                    onChange={(e) => {
                      setTargetOrg(e.target.value)
                      clearError("targetOrg")
                    }}
                    aria-invalid={Boolean(errors.targetOrg)}
                    aria-describedby={
                      errors.targetOrg ? "git-target-org-error" : undefined
                    }
                    className="font-mono text-xs"
                  />
                  <FieldError id="git-target-org-error" className="text-[11px]">
                    {errors.targetOrg}
                  </FieldError>
                </Field>

                <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                  <span className="block font-semibold text-primary">
                    Permissions Automatically Configured:
                  </span>
                  <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
                    <li>Repository Contents: Read</li>
                    <li>Commit Statuses & Deployments: Write</li>
                    <li>Push & Pull Request Webhooks: Subscribed</li>
                  </ul>
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await startGitHubAppSetup(
                          appName.trim() || "Tako Edge Deployer",
                          targetOrg.trim()
                        )
                      } catch (err: unknown) {
                        setSetupErrorMessage(
                          err instanceof Error
                            ? err.message
                            : "Failed to start GitHub App setup."
                        )
                      }
                    }}
                    className="w-full gap-2 border-primary/40 text-xs text-primary hover:bg-primary/10"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>Launch GitHub 1-Click App Registration</span>
                  </Button>
                  <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                    Redirects to GitHub to register the app with pre-filled scopes and returns here automatically.
                  </p>
                </div>
              </FieldGroup>
            ) : (
              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel className="text-xs">Git Provider</FieldLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {(["github", "gitlab", "gitea"] as const).map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => setPatProvider(prov)}
                        className={cn(
                          "rounded border px-2.5 py-1.5 font-mono text-xs uppercase transition-colors",
                          patProvider === prov
                            ? "border-primary bg-primary/10 font-semibold text-primary"
                            : "border-border bg-card text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {prov}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field data-invalid={Boolean(errors.patUsername)}>
                  <FieldLabel className="text-xs">Username / Org</FieldLabel>
                  <Input
                    placeholder="e.g. octocat"
                    value={patUsername}
                    onChange={(e) => {
                      setPatUsername(e.target.value)
                      clearError("patUsername")
                    }}
                    aria-invalid={Boolean(errors.patUsername)}
                    aria-describedby={
                      errors.patUsername ? "git-pat-username-error" : undefined
                    }
                    className="font-mono text-xs"
                  />
                  <FieldError
                    id="git-pat-username-error"
                    className="text-[11px]"
                  >
                    {errors.patUsername}
                  </FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.patToken)}>
                  <FieldLabel className="text-xs">
                    Personal Access Token
                  </FieldLabel>
                  <Input
                    type="password"
                    placeholder="ghp_... or glpat-..."
                    value={patToken}
                    onChange={(e) => {
                      setPatToken(e.target.value)
                      clearError("patToken")
                    }}
                    aria-invalid={Boolean(errors.patToken)}
                    aria-describedby={
                      errors.patToken ? "git-pat-token-error" : undefined
                    }
                    className="font-mono text-xs"
                  />
                  <FieldError id="git-pat-token-error" className="text-[11px]">
                    {errors.patToken}
                  </FieldError>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Requires repo or read_repository scope permissions.
                  </p>
                </Field>
              </FieldGroup>
            )}

            <DialogFooter className="gap-2 pt-2 sm:gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConnectModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isConnecting}
                className="gap-1.5 text-xs"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : connectTab === "app" ? (
                  <>
                    <GitHubIcon className="size-3.5" />
                    <span>Save & Connect GitHub</span>
                  </>
                ) : (
                  <>
                    <Key className="size-3.5" />
                    <span>Connect with PAT</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
