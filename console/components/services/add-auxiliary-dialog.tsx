"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CircleNotchIcon,
  CpuIcon,
  ClockIcon,
  InfoIcon,
} from "@phosphor-icons/react"
import {
  api,
  type Service,
  type ServiceDetail,
  type ServiceType,
} from "@/lib/api"
import { cn } from "@/lib/utils"

export interface AddAuxiliaryFormProps {
  parentService: ServiceDetail
  onSuccess: (newService: Service) => void
  onCancel: () => void
}

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 mins", value: "*/5 * * * *" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
]

export function AddAuxiliaryForm({
  parentService,
  onSuccess,
  onCancel,
}: AddAuxiliaryFormProps) {
  const [serviceType, setServiceType] = React.useState<"worker" | "cron">(
    "worker"
  )
  const [name, setName] = React.useState("")
  const [command, setCommand] = React.useState("")
  const [cronExpression, setCronExpression] = React.useState("* * * * *")
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Service name is required.")
      return
    }

    const trimmedCommand = command.trim()
    if (!trimmedCommand) {
      setError("Execution command is required.")
      return
    }

    if (serviceType === "cron") {
      const trimmedCron = cronExpression.trim()
      const parts = trimmedCron.split(/\s+/)
      if (parts.length !== 5) {
        setError("Cron expression must consist of 5 fields (e.g. * * * * *).")
        return
      }
    }

    setIsSubmitting(true)

    try {
      const created = await api.services.create({
        project_id: parentService.project_id,
        server_id: parentService.server_id,
        name: trimmedName,
        service_type: serviceType,
        parent_service_id: parentService.id,
        command: trimmedCommand,
        cron_expression:
          serviceType === "cron" ? cronExpression.trim() : undefined,
        repository: parentService.repository,
        branch: parentService.branch,
        dockerfile_path: parentService.dockerfile_path,
        internal_port: 0,
        health_check_path: "",
      })

      onSuccess(created)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create auxiliary service. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <DialogHeader className="text-left">
        <DialogTitle>Add Auxiliary Service</DialogTitle>
        <DialogDescription>
          Run background workers or scheduled cron tasks using the built
          container image of {parentService.name}.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div
          role="alert"
          className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive"
        >
          {error}
        </div>
      )}

      {/* Service Type Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground">
          Service Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setServiceType("worker")}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border p-3 text-left transition-colors",
              serviceType === "worker"
                ? "border-primary bg-primary/5 font-semibold text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50"
            )}
          >
            <CpuIcon
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="flex flex-col text-xs">
              <span className="font-medium text-foreground">
                Background Worker
              </span>
              <span className="text-2xs text-muted-foreground">
                Queue or stream worker
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setServiceType("cron")}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border p-3 text-left transition-colors",
              serviceType === "cron"
                ? "border-primary bg-primary/5 font-semibold text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50"
            )}
          >
            <ClockIcon
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="flex flex-col text-xs">
              <span className="font-medium text-foreground">
                Scheduled Cron
              </span>
              <span className="text-2xs text-muted-foreground">
                Periodic scheduled task
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Service Name */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="aux-name"
          className="text-xs font-medium text-foreground"
        >
          Service Name
        </label>
        <Input
          id="aux-name"
          placeholder={
            serviceType === "worker" ? "queue-worker" : "daily-cleanup"
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="font-mono text-sm"
          disabled={isSubmitting}
          autoComplete="off"
        />
      </div>

      {/* Command */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="aux-cmd"
          className="text-xs font-medium text-foreground"
        >
          Container Command
        </label>
        <Input
          id="aux-cmd"
          placeholder={
            serviceType === "worker"
              ? "php artisan queue:work --sleep=3 --tries=3"
              : "php artisan schedule:run"
          }
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className="font-mono text-xs"
          disabled={isSubmitting}
          autoComplete="off"
        />
        <p className="text-2xs text-muted-foreground">
          Custom process command executed inside the application container.
        </p>
      </div>

      {/* Cron Expression (if cron) */}
      {serviceType === "cron" && (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="aux-cron"
            className="text-xs font-medium text-foreground"
          >
            Cron Schedule (5-field expression)
          </label>
          <Input
            id="aux-cron"
            placeholder="* * * * *"
            value={cronExpression}
            onChange={(e) => setCronExpression(e.target.value)}
            className="font-mono text-sm"
            disabled={isSubmitting}
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setCronExpression(preset.value)}
                className="h-8 cursor-pointer rounded border border-border bg-muted/40 px-2.5 font-mono text-2xs text-foreground transition-colors hover:bg-muted"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Context note */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <InfoIcon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span>
          This auxiliary service inherits environment variables and active
          container images directly from {parentService.name}.
        </span>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? (
            <>
              <CircleNotchIcon
                className="size-4 animate-spin"
                aria-hidden="true"
              />
              Creating...
            </>
          ) : (
            "Create Auxiliary Service"
          )}
        </Button>
      </div>
    </form>
  )
}

export interface AddAuxiliaryDialogProps {
  parentService: ServiceDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (newService: Service) => void
}

export function AddAuxiliaryDialog({
  parentService,
  open,
  onOpenChange,
  onSuccess,
}: AddAuxiliaryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <AddAuxiliaryForm
          parentService={parentService}
          onSuccess={(s) => {
            onSuccess(s)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
