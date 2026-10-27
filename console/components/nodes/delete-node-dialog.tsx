"use client"

import * as React from "react"
import { AlertTriangle, Trash2 } from "lucide-react"

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
import { ClusterNode } from "@/types/platform"
import { activeStatusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"

interface DeleteNodeDialogProps {
  node: ClusterNode | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (nodeId: string) => Promise<void> | void
}

export function DeleteNodeDialog({
  node,
  open,
  onOpenChange,
  onConfirm,
}: DeleteNodeDialogProps) {
  const [confirmationName, setConfirmationName] = React.useState("")
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    if (isDeleting) return
    if (!nextOpen) {
      setError(null)
      setIsDeleting(false)
      setConfirmationName("")
    }
    onOpenChange(nextOpen)
  }

  if (!node) return null

  const isMaster = node.role === "master"
  const hasServices = (node.servicesCount ?? 0) > 0
  const isConfirmed = confirmationName.trim() === node.name.trim()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {isMaster ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Cannot Delete Master Node</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                The master node is required for cluster orchestration and operations.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-muted-foreground">
                <p className="leading-relaxed">
                  <strong className="text-foreground">{node.name}</strong> is
                  currently designated as the cluster master. Removing the master
                  node will cause complete loss of cluster management and
                  telemetry synchronization.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="block font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  Node identifier
                </span>
                <div className="rounded border border-border/80 bg-muted/20 px-3 py-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-semibold text-foreground">
                      {node.name}
                    </span>
                    <span className="text-muted-foreground">
                      {node.ipAddress}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="size-4 shrink-0" />
                <span>Confirm Node Removal</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                This will unregister the node and sever agent telemetry connections.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {hasServices ? (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">
                        Active Services Detected
                      </p>
                      <p className="leading-relaxed">
                        This node currently hosts{" "}
                        <strong className="text-foreground">
                          {node.servicesCount} installed{" "}
                          {node.servicesCount === 1 ? "service" : "services"}
                        </strong>
                        . Deleting this node will force remove all assigned
                        services and terminate their containers.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-muted-foreground">
                  <p className="leading-relaxed">
                    Are you sure you want to remove{" "}
                    <strong className="text-foreground">{node.name}</strong> from
                    the cluster? This action cannot be undone.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="block font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  Node identifier
                </span>
                <div className="rounded border border-border/80 bg-muted/20 px-3 py-2 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {node.name}
                    </span>
                    <span className="text-muted-foreground">
                      {node.ipAddress}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{node.os}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          activeStatusDotClass(node.status === "online")
                        )}
                      />
                      <span className="capitalize">{node.status}</span>
                      <span>•</span>
                      <span className="capitalize">{node.role}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor="node-confirmation-input"
                  className="block text-xs text-foreground"
                >
                  Please type{" "}
                  <span className="font-mono font-semibold text-destructive">
                    {node.name}
                  </span>{" "}
                  to confirm:
                </label>
                <Input
                  id="node-confirmation-input"
                  value={confirmationName}
                  onChange={(e) => setConfirmationName(e.target.value)}
                  placeholder={node.name}
                  disabled={isDeleting}
                  autoComplete="off"
                  className="font-mono text-xs"
                />
              </div>

              {error && (
                <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!isConfirmed || isDeleting}
                onClick={async () => {
                  if (!isConfirmed) return
                  try {
                    setIsDeleting(true)
                    setError(null)
                    await onConfirm(node.id)
                    handleOpenChange(false)
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Failed to delete node"
                    )
                  } finally {
                    setIsDeleting(false)
                  }
                }}
              >
                {isDeleting ? "Removing..." : "Remove Node"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
