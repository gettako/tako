"use client"

import * as React from "react"
import { ExternalLink, FolderGit2, Key, RefreshCw } from "lucide-react"
import { z } from "zod"

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
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { cn } from "@/lib/utils"

export function GitHubIcon({ className }: { className?: string }) {
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

const gitConnectionSchema = z
  .object({
    connectTab: z.enum(["app", "pat"]),
    appName: z.string().trim(),
    accountType: z.enum(["org", "personal"]).optional(),
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
      if (values.accountType === "org" && !values.targetOrg) {
        context.addIssue({
          code: "custom",
          path: ["targetOrg"],
          message: "Target organization is required.",
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

interface GitConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export function GitConnectModal({
  open,
  onOpenChange,
  onSuccess,
  onError,
}: GitConnectModalProps) {
  const { startGitHubAppSetup, connectGitProvider } = usePlatformData()

  const [connectTab, setConnectTab] = React.useState<"app" | "pat">("app")
  const [appName, setAppName] = React.useState(
    () => `tako-${Math.floor(10000 + Math.random() * 90000)}`
  )
  const [accountType, setAccountType] = React.useState<"org" | "personal">("org")
  const [targetOrg, setTargetOrg] = React.useState("gettako")

  // PAT Form state
  const [patProvider, setPatProvider] = React.useState<
    "github" | "gitlab" | "gitea"
  >("github")
  const [patUsername, setPatUsername] = React.useState("")
  const [patToken, setPatToken] = React.useState("")
  const [isConnecting, setIsConnecting] = React.useState(false)

  const { errors, validate, clearError } = useZodForm(gitConnectionSchema)

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({
      connectTab,
      appName,
      accountType,
      targetOrg,
      patProvider,
      patUsername,
      patToken,
    })
    if (!valid) return

    setIsConnecting(true)
    try {
      if (connectTab === "app") {
        await startGitHubAppSetup(
          appName.trim() || "Tako Deployer",
          accountType === "org" ? targetOrg.trim() : "",
          accountType === "org"
        )
      } else {
        await connectGitProvider({
          type: patProvider,
          name: `${patProvider.toUpperCase()} (${patUsername.trim()})`,
          username: patUsername.trim(),
          token: patToken,
          connected: true,
          connectionType: "pat",
        })
        onSuccess(
          `${patProvider.toUpperCase()} personal access token connected successfully.`
        )
      }
      onOpenChange(false)
    } catch (err: unknown) {
      onError(
        err instanceof Error ? err.message : "Failed to connect Git provider."
      )
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderGit2 className="size-4 shrink-0 text-primary" />
            <span>Connect Git Provider</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Link repositories for automated push-to-deploy pipelines and branch
            builds.
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

        <form onSubmit={handleConnectSubmit} noValidate className="space-y-4 pt-2">
          {connectTab === "app" ? (
            <FieldGroup className="gap-3">
              <Field data-invalid={Boolean(errors.appName)}>
                <div className="flex items-center justify-between">
                  <FieldLabel className="text-xs">GitHub App Name</FieldLabel>
                  <button
                    type="button"
                    onClick={() =>
                      setAppName(
                        `tako-${Math.floor(10000 + Math.random() * 90000)}`
                      )
                    }
                    className="font-mono text-[11px] text-primary hover:underline"
                  >
                    generate random
                  </button>
                </div>
                <Input
                  value={appName}
                  onChange={(e) => {
                    setAppName(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-")
                    )
                    clearError("appName")
                  }}
                  placeholder="e.g. tako-58291"
                  aria-invalid={Boolean(errors.appName)}
                  aria-describedby={
                    errors.appName ? "git-app-name-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError id="git-app-name-error" className="text-[11px]">
                  {errors.appName}
                </FieldError>
              </Field>

              <Field>
                <FieldLabel className="text-xs">
                  Register GitHub App Under
                </FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountType("org")
                      clearError("targetOrg")
                    }}
                    className={cn(
                      "rounded border px-2.5 py-1.5 text-xs transition-colors",
                      accountType === "org"
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Organization
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountType("personal")
                      clearError("targetOrg")
                    }}
                    className={cn(
                      "rounded border px-2.5 py-1.5 text-xs transition-colors",
                      accountType === "personal"
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Personal Account
                  </button>
                </div>
              </Field>

              {accountType === "org" ? (
                <Field data-invalid={Boolean(errors.targetOrg)}>
                  <FieldLabel className="text-xs">
                    Target GitHub Organization
                  </FieldLabel>
                  <Input
                    value={targetOrg}
                    placeholder="e.g. gettako"
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
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    The App will be registered in your organization settings
                    (github.com/organizations/{targetOrg || "org"}/settings/apps/new).
                  </p>
                </Field>
              ) : (
                <p className="rounded border border-border/60 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  The App will be registered under your personal GitHub profile.
                  You can still install it into multiple organizations later.
                </p>
              )}

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
                        appName.trim().toLowerCase(),
                        accountType === "org" ? targetOrg.trim() : "",
                        accountType === "org"
                      )
                    } catch (err: unknown) {
                      onError(
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
                  Redirects to GitHub to register the app with pre-filled
                  scopes and returns here automatically.
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
                <FieldError id="git-pat-username-error" className="text-[11px]">
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
              onClick={() => onOpenChange(false)}
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
  )
}

