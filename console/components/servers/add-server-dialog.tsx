"use client"

import * as React from "react"
import {
  CircleNotchIcon,
  Check,
  Copy,
  TerminalWindow,
  FileCode,
  CheckCircleIcon,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { api, ApiError, type Server } from "@/lib/api"
import { cn } from "@/lib/utils"

export interface AddServerWizardProps {
  onSuccess?: (server: Server) => void
  onCancel?: () => void
  autoFocus?: boolean
}

export function AddServerWizard({
  onSuccess,
  onCancel,
  autoFocus = true,
}: AddServerWizardProps) {
  const [step, setStep] = React.useState<"form" | "install" | "success">("form")
  const [name, setName] = React.useState("")
  const [region, setRegion] = React.useState("US-East")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Step 2 & 3 state
  const [createdServer, setCreatedServer] = React.useState<Server | null>(null)
  const [enrollmentToken, setEnrollmentToken] = React.useState("")
  const [composeSnippet, setComposeSnippet] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<"command" | "compose">(
    "command"
  )
  const { copy: copyCommand, isCopied: copiedCommand } =
    useCopyToClipboard(2000)
  const { copy: copyCompose, isCopied: copiedCompose } =
    useCopyToClipboard(2000)
  const [isPolling, setIsPolling] = React.useState(false)

  // Polling for server enrollment
  React.useEffect(() => {
    if (!isPolling || !createdServer) return

    let cancelled = false
    const interval = setInterval(async () => {
      try {
        const detail = await api.servers.get(createdServer.id)
        if (cancelled) return

        if (detail.status === "online") {
          setIsPolling(false)
          setCreatedServer(detail)
          setStep("success")
          if (onSuccess) {
            onSuccess(detail)
          }
        }
      } catch {
        // Continue polling until modal is closed or timeout
      }
    }, 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isPolling, createdServer, onSuccess])

  const installCommand = React.useMemo(() => {
    return `curl -sSL https://gettako.dev/install-agent.sh | TAKO_SERVER="https://gettako.dev" TAKO_TOKEN="${enrollmentToken}" bash`
  }, [enrollmentToken])

  const handleCopyCommand = async () => {
    await copyCommand(installCommand)
  }

  const handleCopyCompose = async () => {
    await copyCompose(composeSnippet)
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMessage("Server name is required.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await api.servers.create({
        name: name.trim(),
        host: region ? `pending-${region.toLowerCase()}` : undefined,
      })

      setCreatedServer(res.server)
      setEnrollmentToken(res.enrollment_token)
      setComposeSnippet(res.compose_snippet)
      setStep("install")
      setIsPolling(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to initiate server enrollment.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 text-foreground">
      {step === "form" && (
        <form onSubmit={handleSubmitForm} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add New Server</DialogTitle>
            <DialogDescription>
              Connect a remote VPS or bare-metal host using the Tako Agent.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="server-name"
              className="text-xs font-medium text-foreground"
            >
              Server Nickname <span className="text-destructive">*</span>
            </label>
            <Input
              id="server-name"
              placeholder="e.g. Worker-EU-1"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              disabled={isSubmitting}
              autoFocus={autoFocus}
              className="h-10"
            />
            <p className="text-2xs text-muted-foreground">
              A human-friendly label for this host node.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="server-region"
              className="text-xs font-medium text-foreground"
            >
              Region / Location Tag
            </label>
            <Input
              id="server-region"
              placeholder="e.g. US-East or Frankfurt"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={isSubmitting}
              className="h-10"
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <CircleNotchIcon className="size-4 animate-spin" />
                  <span>Generating Token...</span>
                </>
              ) : (
                <span>Continue</span>
              )}
            </Button>
          </div>
        </form>
      )}

      {step === "install" && (
        <div className="flex flex-col gap-4">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle>Install Tako Agent</DialogTitle>
            <DialogDescription>
              Run this command on your remote server to complete enrollment.
            </DialogDescription>
            <span className="mt-1.5 w-fit rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-600 dark:text-amber-400">
              Expires in 60m
            </span>
          </DialogHeader>

          {/* Segmented Tab Controls */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("command")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === "command"
                  ? "border border-border bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TerminalWindow className="size-3.5" />
              <span>One-line Command</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("compose")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === "compose"
                  ? "border border-border bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileCode className="size-3.5" />
              <span>Docker Compose</span>
            </button>
          </div>

          {/* Code Box */}
          {activeTab === "command" ? (
            <div className="rounded-md border border-border bg-muted/60">
              <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                <span className="font-mono text-2xs text-muted-foreground">
                  install.sh
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCommand}
                  aria-label="Copy install command"
                  className="h-6 px-2 text-xs"
                >
                  {copiedCommand ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" />
                      <span className="ml-1 text-2xs">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span className="ml-1 text-2xs">Copy</span>
                    </>
                  )}
                </Button>
              </div>
              <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-foreground">
                {installCommand}
              </pre>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-muted/60">
              <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                <span className="font-mono text-2xs text-muted-foreground">
                  docker-compose.yml
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCompose}
                  aria-label="Copy Docker Compose snippet"
                  className="h-6 px-2 text-xs"
                >
                  {copiedCompose ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" />
                      <span className="ml-1 text-2xs">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span className="ml-1 text-2xs">Copy</span>
                    </>
                  )}
                </Button>
              </div>
              <pre className="max-h-56 overflow-auto p-3 font-mono text-xs leading-relaxed text-foreground">
                {composeSnippet}
              </pre>
            </div>
          )}

          {/* Waiting Radar indicator */}
          <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
            <div className="relative flex size-8 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500/20" />
              <CircleNotchIcon className="size-5 animate-spin text-blue-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                Waiting for agent connection...
              </span>
              <span className="text-2xs text-muted-foreground">
                Execute the snippet on your host. This dialog will update
                automatically.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Close
            </Button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
            <CheckCircleIcon className="size-6" />
          </div>

          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Server Enrolled Successfully!
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Node{" "}
              <span className="font-medium text-foreground">
                {createdServer?.name}
              </span>{" "}
              is online and ready to receive deployments.
            </p>
          </div>

          <div className="w-full rounded-md border border-border bg-muted/40 p-3 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Host IP:</span>
              <span className="font-mono text-foreground">
                {createdServer?.host}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Agent:</span>
              <span className="font-mono text-foreground">
                {createdServer?.agent_version || "v1.0.0"}
              </span>
            </div>
          </div>

          <div className="mt-2 flex w-full justify-end border-t border-border pt-4">
            <Button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export interface AddServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onServerAdded?: (server: Server) => void
}

export function AddServerDialog({
  open,
  onOpenChange,
  onServerAdded,
}: AddServerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <AddServerWizard
          onSuccess={(server) => {
            if (onServerAdded) onServerAdded(server)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
