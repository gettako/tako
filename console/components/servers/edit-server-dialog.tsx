"use client"

import * as React from "react"
import {
  CircleNotchIcon,
  FloppyDiskIcon,
  PencilSimpleIcon,
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
import { api, ApiError, type Server, type ServerDetail } from "@/lib/api"

export interface EditServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  server: Server | ServerDetail | null
  onServerUpdated?: (updated: ServerDetail) => void
}

export function EditServerDialog({
  open,
  onOpenChange,
  server,
  onServerUpdated,
}: EditServerDialogProps) {
  const [name, setName] = React.useState("")
  const [host, setHost] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (server) {
      setName(server.name || "")
      setHost(server.host || "")
      setErrorMessage(null)
    }
  }, [server, open])

  const isDirty =
    server !== null &&
    (name.trim() !== (server.name || "").trim() ||
      host.trim() !== (server.host || "").trim())

  const isValid = name.trim().length >= 2

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!server || !isValid || !isDirty || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const updated = await api.servers.update(server.id, {
        name: name.trim(),
        host: host.trim(),
      })
      if (onServerUpdated) {
        onServerUpdated(updated)
      }
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to update server settings.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!server) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 text-foreground"
        >
          <DialogHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md border border-border bg-muted/60 text-foreground">
                <PencilSimpleIcon className="size-4" aria-hidden="true" />
              </div>
              <DialogTitle>Edit Server</DialogTitle>
            </div>
            <DialogDescription>
              Update node identification and public network address.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-server-name"
                className="text-xs font-medium text-foreground"
              >
                Server Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="edit-server-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Primary VPS"
                disabled={isSubmitting}
                autoFocus
              />
              <p className="text-2xs text-muted-foreground">
                Descriptive name displayed across dashboards and node cards.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-server-host"
                className="text-xs font-medium text-foreground"
              >
                Host IP / Domain
              </label>
              <Input
                id="edit-server-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="e.g. 198.51.100.22 or vps.example.com"
                disabled={isSubmitting}
              />
              <p className="text-2xs text-muted-foreground">
                The public IPv4 address or FQDN of this node. Used for DNS A
                record verification and quick access.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={!isValid || !isDirty || isSubmitting}
              className="cursor-pointer gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <CircleNotchIcon
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FloppyDiskIcon className="size-3.5" aria-hidden="true" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
