"use client"

import * as React from "react"
import {
  GlobeIcon,
  CheckIcon,
  CircleNotchIcon,
  WarningIcon,
  ShieldCheckIcon,
  ArrowSquareOutIcon,
  ArrowClockwiseIcon,
  InfoIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { api, ApiError, type ConsoleDomainConfig } from "@/lib/api"
import { cn } from "@/lib/utils"

export function ConsoleDomainCard({
  onDomainUpdated,
}: {
  onDomainUpdated?: (config: ConsoleDomainConfig) => void
}) {
  const [config, setConfig] = React.useState<ConsoleDomainConfig | null>(null)
  const [domainInput, setDomainInput] = React.useState("")
  const [sslProvider, setSslProvider] = React.useState<
    "letsencrypt" | "none" | "custom"
  >("letsencrypt")
  const [forceHttps, setForceHttps] = React.useState(true)
  const [customCert, setCustomCert] = React.useState("")
  const [customKey, setCustomKey] = React.useState("")

  const [isLoading, setIsLoading] = React.useState(true)
  const [isVerifying, setIsVerifying] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)

  const [dnsResult, setDnsResult] = React.useState<{
    matches: boolean
    domain: string
    resolvedIps: string[]
    expectedIp: string
    errorMessage?: string | null
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function loadConfig() {
      try {
        const data = await api.system.getConsoleDomain()
        if (!cancelled) {
          setConfig(data)
          setDomainInput(data.domain)
          setSslProvider(data.ssl_provider)
          setForceHttps(data.force_https)
          setCustomCert(data.custom_cert || "")
          setCustomKey(data.custom_key || "")
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof ApiError
              ? err.message
              : "Failed to load console domain configuration."
          setFeedback({ type: "error", message: msg })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

  const handleVerifyDNS = async () => {
    const trimmed = domainInput.trim().toLowerCase()
    if (!trimmed) {
      setFeedback({
        type: "error",
        message: "Please enter a valid domain name first.",
      })
      return
    }

    setIsVerifying(true)
    setFeedback(null)
    setDnsResult(null)

    try {
      const res = await api.system.verifyConsoleDomainDNS({ domain: trimmed })
      setDnsResult({
        matches: res.matches,
        domain: res.domain,
        resolvedIps: res.resolved_ips,
        expectedIp: res.expected_ip,
        errorMessage: res.error_message,
      })

      if (res.matches) {
        setFeedback({
          type: "success",
          message: `DNS check passed: ${trimmed} correctly resolves to server IP (${res.expected_ip}).`,
        })
      } else {
        setFeedback({
          type: "error",
          message:
            res.error_message ||
            `DNS mismatch: ${trimmed} points to [${res.resolved_ips.join(", ")}], but server expects ${res.expected_ip}.`,
        })
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to verify domain DNS resolution."
      setFeedback({ type: "error", message: msg })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = domainInput.trim().toLowerCase()
    if (!trimmed || trimmed.includes(" ")) {
      setFeedback({
        type: "error",
        message: "Please enter a valid domain name without spaces.",
      })
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const updated = await api.system.updateConsoleDomain({
        domain: trimmed,
        ssl_provider: sslProvider,
        force_https: forceHttps,
        custom_cert: sslProvider === "custom" ? customCert : undefined,
        custom_key: sslProvider === "custom" ? customKey : undefined,
      })

      setConfig(updated)
      setFeedback({
        type: "success",
        message: `Console domain updated to ${trimmed}. Traefik dynamic routing reloaded successfully.`,
      })
      toast.success(
        `Console domain updated to ${trimmed}. Traefik routing reloaded.`
      )

      if (onDomainUpdated) {
        onDomainUpdated(updated)
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to update console domain."
      setFeedback({ type: "error", message: msg })
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const activeHref =
    config?.domain &&
    config.domain !== "localhost" &&
    !config.domain.startsWith("127.")
      ? `https://${config.domain}`
      : undefined

  if (isLoading) {
    return (
      <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="size-10 animate-pulse rounded-md bg-muted" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-64 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6">
      <form onSubmit={handleSaveDomain} className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
              <GlobeIcon className="size-5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-foreground">
                Console Domain & SSL Ingress
              </h2>
              <p className="text-xs text-muted-foreground">
                Domain routing, HTTPS redirection, and automated SSL for Tako
                control plane.
              </p>
            </div>
          </div>

          {/* Current Status Pill */}
          {config?.ssl_status && (
            <div
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-medium tracking-wider uppercase",
                config.ssl_status === "active"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : config.ssl_status === "pending"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
              )}
            >
              {config.ssl_status === "active" ? (
                <ShieldCheckIcon className="size-3" />
              ) : config.ssl_status === "pending" ? (
                <CircleNotchIcon className="size-3 animate-spin" />
              ) : (
                <WarningIcon className="size-3" />
              )}
              <span>
                {config.ssl_status === "active"
                  ? "Active"
                  : config.ssl_status === "pending"
                    ? "Validating"
                    : "SSL Error"}
              </span>
            </div>
          )}
        </div>

        {/* Failsafe Notice */}
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">
              Anti-Lockout Protection
            </span>
            <p className="text-2xs leading-relaxed">
              Direct access via port 3000 remains always open as an emergency
              failsafe. If your domain or DNS misconfigures, access your panel
              directly using your server IP address on port 3000.
            </p>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            role="alert"
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : feedback.type === "info"
                  ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {feedback.type === "success" ? (
              <CheckIcon className="mt-0.5 size-4 shrink-0" />
            ) : feedback.type === "info" ? (
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
            ) : (
              <WarningIcon className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="leading-relaxed">{feedback.message}</span>
          </div>
        )}

        {/* Domain Input Field */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="console-domain"
              className="text-xs font-medium text-foreground"
            >
              Control Plane Domain
            </label>
            {activeHref && (
              <a
                href={activeHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>Visit {config?.domain}</span>
                <ArrowSquareOutIcon className="size-3" />
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              id="console-domain"
              type="text"
              value={domainInput}
              onChange={(e) => {
                setDomainInput(e.target.value)
                if (feedback) setFeedback(null)
              }}
              disabled={isSaving || isVerifying}
              placeholder="e.g. tako.yourcompany.com"
              className="h-9 font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleVerifyDNS}
              disabled={isVerifying || isSaving || !domainInput.trim()}
              className="h-9 shrink-0 gap-1.5 text-xs"
            >
              {isVerifying ? (
                <>
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <ArrowClockwiseIcon className="size-3.5" />
                  <span>Verify DNS</span>
                </>
              )}
            </Button>
          </div>
          <p className="text-2xs text-muted-foreground">
            Point your DNS A record to your server public IP address before
            saving to enable automatic Let&apos;s Encrypt certificates.
          </p>
        </div>

        {/* DNS Diagnostics Info Box (if verified) */}
        {dnsResult && (
          <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-2.5 font-mono text-2xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Query Target:</span>
              <span className="text-foreground">{dnsResult.domain}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Server Public IP:</span>
              <span className="text-foreground">
                {dnsResult.expectedIp || "Auto-detect"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">DNS Resolved IPs:</span>
              <span
                className={
                  dnsResult.matches
                    ? "font-semibold text-emerald-500"
                    : "font-semibold text-destructive"
                }
              >
                {dnsResult.resolvedIps.length > 0
                  ? dnsResult.resolvedIps.join(", ")
                  : "None found"}
              </span>
            </div>
          </div>
        )}

        {/* SSL Provider Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-foreground">
            SSL Certificate Mode
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setSslProvider("letsencrypt")}
              className={cn(
                "flex flex-col gap-1 rounded-md border p-2.5 text-left transition-colors",
                sslProvider === "letsencrypt"
                  ? "border-ring bg-muted/40 font-semibold text-foreground ring-1 ring-ring"
                  : "border-input bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-semibold">
                  Let&apos;s Encrypt
                </span>
                {sslProvider === "letsencrypt" && (
                  <CheckIcon className="size-3 text-foreground" />
                )}
              </div>
              <span className="text-2xs text-muted-foreground">
                Automatic HTTP-01 challenge issuance and auto-renewal.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSslProvider("none")}
              className={cn(
                "flex flex-col gap-1 rounded-md border p-2.5 text-left transition-colors",
                sslProvider === "none"
                  ? "border-ring bg-muted/40 font-semibold text-foreground ring-1 ring-ring"
                  : "border-input bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-semibold">HTTP Only</span>
                {sslProvider === "none" && (
                  <CheckIcon className="size-3 text-foreground" />
                )}
              </div>
              <span className="text-2xs text-muted-foreground">
                No TLS encryption. Recommended only behind a CDN or reverse
                proxy.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSslProvider("custom")}
              className={cn(
                "flex flex-col gap-1 rounded-md border p-2.5 text-left transition-colors",
                sslProvider === "custom"
                  ? "border-ring bg-muted/40 font-semibold text-foreground ring-1 ring-ring"
                  : "border-input bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-semibold">Custom Cert</span>
                {sslProvider === "custom" && (
                  <CheckIcon className="size-3 text-foreground" />
                )}
              </div>
              <span className="text-2xs text-muted-foreground">
                Provide custom PEM certificate and private key.
              </span>
            </button>
          </div>
        </div>

        {/* Custom Certificate Inputs */}
        {sslProvider === "custom" && (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="custom-cert"
                className="text-xs font-medium text-foreground"
              >
                Public Certificate (PEM)
              </label>
              <textarea
                id="custom-cert"
                rows={3}
                value={customCert}
                onChange={(e) => setCustomCert(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                className="w-full rounded-md border border-border bg-background p-2 font-mono text-2xs focus:ring-1 focus:ring-ring focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="custom-key"
                className="text-xs font-medium text-foreground"
              >
                Private Key (PEM)
              </label>
              <textarea
                id="custom-key"
                rows={3}
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                className="w-full rounded-md border border-border bg-background p-2 font-mono text-2xs focus:ring-1 focus:ring-ring focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Force HTTPS Checkbox */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex flex-col">
            <label
              htmlFor="force-https"
              className="cursor-pointer text-xs font-medium text-foreground"
            >
              Enforce Automatic HTTPS
            </label>
            <span className="text-2xs text-muted-foreground">
              Permanently redirects HTTP port 80 requests to secure HTTPS port
              443.
            </span>
          </div>
          <input
            id="force-https"
            type="checkbox"
            checked={forceHttps}
            onChange={(e) => setForceHttps(e.target.checked)}
            disabled={isSaving || sslProvider === "none"}
            className="size-4 cursor-pointer rounded border-border accent-foreground"
          />
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end border-t border-border pt-3">
          <Button
            type="submit"
            size="default"
            disabled={isSaving || isVerifying || !domainInput.trim()}
            className="gap-1.5 text-xs"
          >
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <span>Save & Apply Domain</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
