"use client"

import * as React from "react"
import {
  Check,
  Copy,
  Radio,
  RotateCcw,
  RotateCw,
  Save,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"
import { z } from "zod"

import { DEFAULT_PORTS } from "@/lib/api"
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
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { copyToClipboard } from "@/lib/clipboard"
import { isValidHostname, isValidIpAllowlist } from "@/lib/validation"

const networkSchema = z.object({
  masterHost: z
    .string()
    .trim()
    .min(1, "Listen interface is required.")
    .refine(
      (value) => isValidHostname(value),
      "Enter a valid hostname or IP address."
    ),
  masterPort: z
    .string()
    .trim()
    .regex(/^\d+$/, "Port must be a number.")
    .refine((value) => {
      const port = Number(value)
      return port >= 1 && port <= 65535
    }, "Port must be between 1 and 65535."),
  interval: z
    .string()
    .trim()
    .regex(/^\d+$/, "Interval must be a number.")
    .refine((value) => {
      const interval = Number(value)
      return interval >= 1 && interval <= 3600
    }, "Interval must be between 1 and 3600 seconds."),
  ipAllowlist: z
    .string()
    .trim()
    .refine(
      (value) => isValidIpAllowlist(value),
      "Enter IPv4 addresses or CIDR blocks separated by commas."
    ),
  sessionTimeout: z
    .string()
    .trim()
    .regex(/^\d+$/, "Timeout must be a number.")
    .refine((value) => {
      const timeout = Number(value)
      return timeout >= 5 && timeout <= 1440
    }, "Timeout must be between 5 and 1440 minutes."),
})

export function NetworkPanel() {
  const { settings, updateSettings, resetToDefaults, addAuditLog } =
    usePlatformData()

  const [masterHost, setMasterHost] = React.useState(
    settings.masterGrpcHost || "0.0.0.0"
  )
  const [masterPort, setMasterPort] = React.useState(
    (settings.masterGrpcPort || DEFAULT_PORTS.GRPC).toString()
  )
  const [token, setToken] = React.useState(
    settings.clusterToken || "tako_clst_9f8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c"
  )
  const [interval, setInterval] = React.useState(
    (settings.telemetryIntervalSec || 5).toString()
  )
  const [ipAllowlist, setIpAllowlist] = React.useState(
    settings.ipAllowlist || "10.0.0.0/8, 192.168.1.0/24"
  )
  const [sessionTimeout, setSessionTimeout] = React.useState(
    (settings.sessionTimeoutMinutes || 60).toString()
  )
  const { errors, validate, clearError } = useZodForm(networkSchema)

  const [copiedToken, setCopiedToken] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [resetModalOpen, setResetModalOpen] = React.useState(false)

  const handleCopyToken = async () => {
    if (await copyToClipboard(token)) {
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    }
  }

  const handleRegenerateToken = () => {
    const newToken = `tako_clst_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`
    setToken(newToken)
    addAuditLog({
      action: "Cluster Token Regenerated",
      category: "security",
      actor: { name: "admin@tako.internal", type: "user" },
      target: "gRPC Transport",
      details: "Regenerated cluster join authentication secret",
      status: "success",
    })
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({
      masterHost,
      masterPort,
      interval,
      ipAllowlist,
      sessionTimeout,
    })
    if (!valid) return

    updateSettings({
      masterGrpcHost: masterHost.trim(),
      masterGrpcPort: Number.parseInt(masterPort, 10) || DEFAULT_PORTS.GRPC,
      clusterToken: token.trim(),
      telemetryIntervalSec: Number.parseInt(interval, 10) || 5,
      ipAllowlist: ipAllowlist.trim(),
      sessionTimeoutMinutes: Number.parseInt(sessionTimeout, 10) || 60,
    })
    addAuditLog({
      action: "Transport Policies Updated",
      category: "security",
      actor: { name: "admin@tako.internal", type: "user" },
      target: "Daemon Transport",
      details: `Updated listen port ${masterPort} and IP allowlist`,
      status: "success",
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleConfirmReset = () => {
    resetToDefaults()
    setResetModalOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* 1. Master gRPC Daemon Transport */}
      <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={Radio}
          title="Master gRPC Daemon Transport"
          description="Control the core daemon listen interfaces and agent mesh authentication credentials."
        />

        <form onSubmit={handleSave} noValidate className="space-y-5">
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.masterHost)}>
                <FieldLabel className="text-xs">
                  Master Listen Interface
                </FieldLabel>
                <Input
                  value={masterHost}
                  onChange={(e) => {
                    setMasterHost(e.target.value)
                    clearError("masterHost")
                  }}
                  aria-invalid={Boolean(errors.masterHost)}
                  aria-describedby={
                    errors.masterHost ? "master-host-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError id="master-host-error" className="text-[11px]">
                  {errors.masterHost}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.masterPort)}>
                <FieldLabel className="text-xs">gRPC Listen Port</FieldLabel>
                <Input
                  type="number"
                  value={masterPort}
                  onChange={(e) => {
                    setMasterPort(e.target.value)
                    clearError("masterPort")
                  }}
                  aria-invalid={Boolean(errors.masterPort)}
                  aria-describedby={
                    errors.masterPort ? "master-port-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError id="master-port-error" className="text-[11px]">
                  {errors.masterPort}
                </FieldError>
              </Field>
            </div>

            {/* Cluster Join Token */}
            <Field>
              <FieldLabel className="text-xs">
                Cluster Join & Authentication Token
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={token}
                  className="bg-muted/30 font-mono text-xs select-all"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyToken}
                  className="shrink-0 gap-1.5 text-xs"
                >
                  {copiedToken ? (
                    <>
                      <Check className="size-3 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRegenerateToken}
                  className="shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCw className="size-3" />
                  <span>Regenerate</span>
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Node worker daemons require this token during the initial mTLS
                handshake to authenticate and join the cluster mesh.
              </p>
            </Field>

            <Field data-invalid={Boolean(errors.interval)}>
              <FieldLabel className="text-xs">
                Agent Telemetry Heartbeat Interval (seconds)
              </FieldLabel>
              <Input
                type="number"
                value={interval}
                onChange={(e) => {
                  setInterval(e.target.value)
                  clearError("interval")
                }}
                aria-invalid={Boolean(errors.interval)}
                aria-describedby={
                  errors.interval ? "telemetry-interval-error" : undefined
                }
                className="w-32 font-mono text-xs"
              />
              <FieldError id="telemetry-interval-error" className="text-[11px]">
                {errors.interval}
              </FieldError>
            </Field>

            {/* Security Policies */}
            <div className="space-y-4 border-t border-border pt-3">
              <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Security & Ingress Boundaries
              </h3>

              <Field data-invalid={Boolean(errors.ipAllowlist)}>
                <FieldLabel className="text-xs">
                  Cluster Management IP Allowlist (CIDR notation)
                </FieldLabel>
                <Input
                  value={ipAllowlist}
                  onChange={(e) => {
                    setIpAllowlist(e.target.value)
                    clearError("ipAllowlist")
                  }}
                  aria-invalid={Boolean(errors.ipAllowlist)}
                  aria-describedby={
                    errors.ipAllowlist ? "ip-allowlist-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError id="ip-allowlist-error" className="text-[11px]">
                  {errors.ipAllowlist}
                </FieldError>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Only connections matching these CIDR blocks can access the
                  gRPC control plane interface.
                </p>
              </Field>

              <Field data-invalid={Boolean(errors.sessionTimeout)}>
                <FieldLabel className="text-xs">
                  Operator Console Session Timeout (Minutes)
                </FieldLabel>
                <Input
                  type="number"
                  value={sessionTimeout}
                  onChange={(e) => {
                    setSessionTimeout(e.target.value)
                    clearError("sessionTimeout")
                  }}
                  aria-invalid={Boolean(errors.sessionTimeout)}
                  aria-describedby={
                    errors.sessionTimeout ? "session-timeout-error" : undefined
                  }
                  className="w-32 font-mono text-xs"
                />
                <FieldError id="session-timeout-error" className="text-[11px]">
                  {errors.sessionTimeout}
                </FieldError>
              </Field>
            </div>

            <div className="flex justify-end border-t border-border pt-3">
              <Button type="submit" size="sm" className="gap-1.5 text-xs">
                {saved ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span>Transport Settings Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3" />
                    <span>Save Transport Settings</span>
                  </>
                )}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </div>

      {/* 2. Architecture & Runtime Stack */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-5 font-mono text-xs">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span>Architecture & Runtime Stack</span>
        </div>
        <div className="grid grid-cols-1 gap-2 pt-1 text-muted-foreground sm:grid-cols-2">
          <div>
            Master Dashboard:{" "}
            <span className="text-foreground">Next.js 16 (React 19)</span>
          </div>
          <div>
            Master Server:{" "}
            <span className="text-foreground">Golang gRPC Server</span>
          </div>
          <div>
            Node Agent:{" "}
            <span className="text-foreground">Golang Edge Daemon</span>
          </div>
          <div>
            Transport Protocol:{" "}
            <span className="text-foreground">gRPC HTTP/2 mTLS</span>
          </div>
          <div>
            Supported Deployments:{" "}
            <span className="text-foreground">Dockerfile & Docker Compose</span>
          </div>
          <div>
            Telemetry:{" "}
            <span className="text-foreground">
              Push-based bi-directional streams
            </span>
          </div>
        </div>
      </div>

      {/* 3. Demo Data Reset Card */}
      <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="block text-xs font-semibold text-destructive">
            Reset Demo Data State
          </span>
          <p className="text-[11px] text-muted-foreground">
            Restore all cluster nodes, services, registries, snapshots, and
            configuration to initial state.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => setResetModalOpen(true)}
          className="shrink-0 gap-1 text-xs"
        >
          <RotateCcw className="size-3" />
          <span>Reset to Initial State</span>
        </Button>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Reset Cluster Demo Data?</span>
            </DialogTitle>
            <DialogDescription className="pt-1 text-xs leading-relaxed">
              This will restore all sample nodes, services, registries, backup
              schedules, and platform settings back to their factory defaults.
              Any simulated records created during this session will be reset.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmReset}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="size-3" />
              <span>Confirm Reset</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
