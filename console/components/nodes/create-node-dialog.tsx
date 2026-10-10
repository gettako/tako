"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CopyButton } from "@/components/ui/copy-button"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  Terminal,
  Shield,
  CheckCircle2,
  ChevronDown,
  Loader2,
} from "lucide-react"
import { useCreateNodeEnrollToken, useNodes } from "@/lib/queries"
import { Node } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface CreateNodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (node: Node) => void
}

export function CreateNodeDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateNodeDialogProps) {
  const [token, setToken] = useState<string>("")
  const [useSudo, setUseSudo] = useState<boolean>(false)
  const [initialNodeIds, setInitialNodeIds] = useState<Set<string> | null>(null)
  const [newlyConnectedNode, setNewlyConnectedNode] = useState<Node | null>(
    null
  )

  const { data: nodes } = useNodes({
    refetchInterval: open ? 3000 : false,
    enabled: open,
  })

  const enrollMutation = useCreateNodeEnrollToken({
    onSuccess: (data) => {
      if (data?.token) {
        // Normalize token without tako_xxxx prefix
        const cleanToken = data.token
          .replace(/^tako_[a-z0-9]+_/, "")
          .replace(/^tako_/, "")
        setToken(cleanToken)
      }
    },
  })

  useEffect(() => {
    if (open) {
      enrollMutation.mutate()
      setNewlyConnectedNode(null)
      setInitialNodeIds(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !nodes) return
    if (initialNodeIds === null) {
      setInitialNodeIds(new Set(nodes.map((n) => n.id)))
      return
    }
    const newNode = nodes.find((n) => !initialNodeIds.has(n.id))
    if (newNode && !newlyConnectedNode) {
      setNewlyConnectedNode(newNode)
      onSuccess?.(newNode)
    }
  }, [open, nodes, initialNodeIds, newlyConnectedNode, onSuccess])

  const installCommand = token
    ? `curl -fsSL https://gettako.dev/install.sh | ${useSudo ? "sudo " : ""}bash -s -- --agent --token ${token}`
    : `curl -fsSL https://gettako.dev/install.sh | ${useSudo ? "sudo " : ""}bash -s -- --agent`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {/* Strict No-Icon DialogHeader following Vega rules */}
        <DialogHeader className="gap-1.5">
          <DialogTitle className="font-sans text-xl font-bold tracking-tight text-foreground">
            Add Cluster Node
          </DialogTitle>
          <DialogDescription className="text-xs leading-normal text-muted-foreground sm:text-sm">
            Run the agent installer on your target host to automatically enroll
            it as a worker node.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Agent Install Command Box */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Terminal className="size-3.5 text-primary" />
                Run on your host machine
              </span>

              {/* Frictionless bash / sudo toggle */}
              <div className="inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5 text-xs dark:bg-muted/20">
                <button
                  type="button"
                  onClick={() => setUseSudo(false)}
                  className={cn(
                    "cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] transition-colors",
                    !useSudo
                      ? "bg-background font-semibold text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  bash
                </button>
                <button
                  type="button"
                  onClick={() => setUseSudo(true)}
                  className={cn(
                    "cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] transition-colors",
                    useSudo
                      ? "bg-background font-semibold text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  sudo bash
                </button>
              </div>
            </div>

            {/* Command Container with responsive Light/Dark theme background */}
            <div className="relative rounded-xl border border-border bg-muted/50 p-3.5 font-mono text-xs text-foreground transition-colors sm:p-4 sm:text-sm dark:bg-muted/20">
              {enrollMutation.isPending ? (
                <div className="flex items-center gap-2 py-1 font-sans text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>Generating secure cluster enrollment token...</span>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <pre className="flex-1 overflow-x-auto pr-2 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-foreground sm:text-sm">
                    <span className="mr-2 font-normal text-muted-foreground/50 select-none">
                      $
                    </span>
                    <code className="font-mono font-medium text-foreground">
                      {installCommand}
                    </code>
                  </pre>
                  <CopyButton
                    text={installCommand}
                    tooltip="Copy Command"
                    disabled={enrollMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 cursor-pointer gap-1.5 border-border bg-background/80 px-2.5 text-xs text-foreground hover:bg-background active:not-aria-[haspopup]:translate-y-px"
                  >
                    <span className="hidden sm:inline">Copy</span>
                  </CopyButton>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2 className="size-3.5 shrink-0 text-status-success" />
              <span>
                Docker is automatically provisioned if missing. Host specs, IP,
                and architecture are auto-detected.
              </span>
            </div>
          </div>

          {/* Realtime Telemetry / Handshake Indicator */}
          {newlyConnectedNode ? (
            <div className="flex items-center justify-between rounded-lg border border-status-success/30 bg-status-success/10 px-3.5 py-2.5 text-xs text-status-success">
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-status-success" />
                <span className="truncate font-medium">
                  Node connected:{" "}
                  <strong className="font-semibold text-foreground">
                    {newlyConnectedNode.name ||
                      newlyConnectedNode.ipAddress ||
                      newlyConnectedNode.id}
                  </strong>
                </span>
              </div>
              <Badge
                variant="secondary"
                className="shrink-0 border-0 bg-status-success/20 font-mono text-[10px] text-status-success"
              >
                Online
              </Badge>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-status-success"></span>
                </span>
                <span className="text-xs font-medium text-foreground">
                  Waiting for node connection...
                </span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                Role: Worker
              </span>
            </div>
          )}

          {/* Collapsible System & Firewall Requirements (Friction-Free) */}
          <Collapsible className="rounded-lg border border-border bg-card/50 text-xs">
            <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                System & firewall requirements
              </span>
              <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border/60 px-3.5 pt-1 pb-3">
              <div className="grid grid-cols-1 gap-2 pt-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-status-success" />
                  <span>Linux 64-bit (x86_64 or ARM64)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-status-success" />
                  <span>TCP Ports 9443 (RPC) & 7946 open</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-status-success" />
                  <span>Docker Engine (auto-installed if absent)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-status-success" />
                  <span>Min. 1 vCPU & 1 GB RAM available</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 cursor-pointer text-xs active:not-aria-[haspopup]:translate-y-px sm:text-sm"
          >
            {newlyConnectedNode ? "Done" : "Close"}
          </Button>
          <CopyButton
            text={installCommand}
            variant="default"
            size="sm"
            disabled={enrollMutation.isPending}
            className="h-9 cursor-pointer gap-1.5 bg-primary px-4 text-xs text-primary-foreground hover:bg-primary/90 active:not-aria-[haspopup]:translate-y-px sm:text-sm"
          >
            Copy Command
          </CopyButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Re-export as RegisterNodeDialog for backwards compatibility
export { CreateNodeDialog as RegisterNodeDialog }
