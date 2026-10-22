"use client"

import * as React from "react"
import {
  Check,
  CheckCircle2,
  Copy,
  Globe,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react"
import { z } from "zod"

import { SettingsSectionHeader } from "@/components/settings/settings-section-header"
import { Button } from "@/components/ui/button"
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
import { isValidHostname, isValidIpv4 } from "@/lib/validation"
import { cn } from "@/lib/utils"

const domainSchema = z
  .object({
    domain: z
      .string()
      .trim()
      .min(1, "Cluster domain is required.")
      .refine(isValidHostname, "Enter a valid domain name."),
    customIp: z
      .string()
      .trim()
      .refine(
        (value) => !value || isValidIpv4(value),
        "Enter a valid IPv4 address."
      ),
    dnsProvider: z.enum(["http01", "cloudflare"]),
    cloudflareToken: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (values.dnsProvider === "cloudflare" && !values.cloudflareToken) {
      context.addIssue({
        code: "custom",
        path: ["cloudflareToken"],
        message: "Cloudflare API token is required for DNS-01.",
      })
    }
  })

export function DomainPanel() {
  const {
    nodes,
    domainConfig,
    updateDomainConfig,
    verifyDomain,
    reloadTraefik,
  } = usePlatformData()

  const leaderNode = nodes.find((n) => n.role === "master") || nodes[0]
  const detectedLeaderIp = leaderNode?.ipAddress || "142.250.190.46"

  const [domain, setDomain] = React.useState(domainConfig.domain)
  const [sslAutoRenew, setSslAutoRenew] = React.useState(
    domainConfig.sslAutoRenew
  )
  const [dnsProvider, setDnsProvider] = React.useState<"http01" | "cloudflare">(
    domainConfig.dnsProvider
  )
  const [cloudflareToken, setCloudflareToken] = React.useState(
    domainConfig.cloudflareApiToken || ""
  )
  const [showCustomIp, setShowCustomIp] = React.useState(
    Boolean(domainConfig.customDnsIp)
  )
  const [customIp, setCustomIp] = React.useState(domainConfig.customDnsIp || "")
  const { errors, validate, clearError } = useZodForm(domainSchema)

  const [isVerifying, setIsVerifying] = React.useState(false)
  const [verificationResult, setVerificationResult] = React.useState<{
    ok: boolean
    message: string
  } | null>({
    ok: true,
    message: "DNS A-Record resolved correctly to " + detectedLeaderIp,
  })
  const [isReloadingTraefik, setIsReloadingTraefik] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [copiedIp, setCopiedIp] = React.useState(false)

  const effectiveIp = customIp.trim() || detectedLeaderIp

  const handleVerifyDns = async () => {
    setIsVerifying(true)
    try {
      const res = await verifyDomain(domain.trim(), effectiveIp)
      setVerificationResult({
        ok: res.ok,
        message: res.message,
      })
    } catch (err: unknown) {
      setVerificationResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Failed to verify domain DNS resolution.",
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleReloadTraefik = async () => {
    setIsReloadingTraefik(true)
    try {
      await reloadTraefik(leaderNode?.id)
    } catch {
      // silently handle
    } finally {
      setIsReloadingTraefik(false)
    }
  }

  const handleCopyIp = async () => {
    if (await copyToClipboard(effectiveIp)) {
      setCopiedIp(true)
      setTimeout(() => setCopiedIp(false), 2000)
    }
  }

  const handleSaveDomain = (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({ domain, customIp, dnsProvider, cloudflareToken })
    if (!valid) return

    updateDomainConfig({
      domain: domain.trim(),
      sslAutoRenew,
      dnsProvider,
      cloudflareApiToken: cloudflareToken.trim(),
      customDnsIp: customIp.trim(),
      lastCheckedAt: "Just now",
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={Globe}
          title="Cluster Domain & Ingress Routing"
          description="Configure the primary control plane domain, automatic Let's Encrypt TLS issuance, and DNS challenge providers."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReloadTraefik}
              disabled={isReloadingTraefik}
              className="gap-1.5 text-xs"
            >
              <RefreshCw
                className={cn("size-3", isReloadingTraefik && "animate-spin")}
              />
              <span>
                {isReloadingTraefik ? "Reloading..." : "Reload Traefik"}
              </span>
            </Button>
          }
        />

        <form onSubmit={handleSaveDomain} noValidate className="space-y-5">
          <FieldGroup className="gap-4">
            {/* Domain input */}
            <Field data-invalid={Boolean(errors.domain)}>
              <FieldLabel className="text-xs">
                Primary Cluster Ingress Domain
              </FieldLabel>
              <Input
                placeholder="e.g. edge.gettako.dev or cluster.company.com"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value)
                  clearError("domain")
                }}
                aria-invalid={Boolean(errors.domain)}
                aria-describedby={
                  errors.domain ? "cluster-domain-error" : undefined
                }
                className="max-w-lg font-mono text-xs"
              />
              <FieldError id="cluster-domain-error" className="text-[11px]">
                {errors.domain}
              </FieldError>
              <p className="mt-1 text-[11px] text-muted-foreground">
                All edge service subdomains and control plane API endpoints
                resolve under this namespace.
              </p>
            </Field>

            {/* DNS Instructions Card */}
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="block text-xs font-semibold text-foreground">
                    DNS Configuration Instructions
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Add the following A-Record at your DNS provider (Cloudflare,
                    Route53, Namecheap):
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleVerifyDns}
                  disabled={isVerifying}
                  className="shrink-0 gap-1.5 text-xs"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      <span>Verify DNS & SSL</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Record Spec Box */}
              <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-card p-3 font-mono text-xs sm:grid-cols-3">
                <div>
                  <span className="block font-sans text-[10px] text-muted-foreground">
                    Record Type
                  </span>
                  <span className="font-semibold text-foreground">A</span>
                </div>
                <div>
                  <span className="block font-sans text-[10px] text-muted-foreground">
                    Hostname
                  </span>
                  <span className="font-semibold text-foreground">
                    {domain ? domain.split(".")[0] || "@" : "@"}
                  </span>
                </div>
                <div>
                  <span className="block font-sans text-[10px] text-muted-foreground">
                    Target IPv4
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">
                      {effectiveIp}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyIp}
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy IP"
                    >
                      {copiedIp ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {verificationResult && (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2.5 text-xs",
                    verificationResult.ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  )}
                >
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span className="font-mono text-[11px] leading-relaxed">
                    {verificationResult.message}
                  </span>
                </div>
              )}

              {/* Custom DNS IP Override Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowCustomIp(!showCustomIp)}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {showCustomIp
                    ? "Hide custom DNS IP override"
                    : "Need a custom DNS IP (e.g. Cloudflare proxy or load balancer)?"}
                </button>

                {showCustomIp && (
                  <Field
                    data-invalid={Boolean(errors.customIp)}
                    className="mt-2 max-w-sm"
                  >
                    <FieldLabel className="text-[11px]">
                      Custom Ingress IP / Load Balancer IPv4
                    </FieldLabel>
                    <Input
                      value={customIp}
                      onChange={(e) => {
                        setCustomIp(e.target.value.trim())
                        clearError("customIp")
                      }}
                      placeholder="e.g. 198.51.100.42"
                      aria-invalid={Boolean(errors.customIp)}
                      aria-describedby={
                        errors.customIp ? "custom-ip-error" : undefined
                      }
                      className="h-8 font-mono text-xs"
                    />
                    <FieldError id="custom-ip-error" className="text-[11px]">
                      {errors.customIp}
                    </FieldError>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Leave blank to use the detected master node IP (
                      {detectedLeaderIp}).
                    </p>
                  </Field>
                )}
              </div>
            </div>

            {/* Let's Encrypt TLS Automation */}
            <div className="space-y-4 border-t border-border pt-2">
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ShieldCheck className="size-3.5 text-emerald-500" />
                    <span>Automatic Let&apos;s Encrypt TLS Certificates</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Automatically provisions and renews SSL/TLS certificates via
                    Traefik ACME before expiration.
                  </p>
                </div>
                <input
                  type="checkbox"
                  aria-label="Toggle automatic Let's Encrypt TLS"
                  checked={sslAutoRenew}
                  onChange={(e) => setSslAutoRenew(e.target.checked)}
                  className="size-4 cursor-pointer rounded accent-primary"
                />
              </div>

              {/* ACME DNS Challenge Provider */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-foreground">
                  ACME DNS Challenge Provider
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setDnsProvider("http01")}
                    className={cn(
                      "w-full cursor-pointer space-y-1 rounded-md border p-3 text-left transition-all",
                      dnsProvider === "http01"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        HTTP-01 Challenge
                      </span>
                      {dnsProvider === "http01" && (
                        <CheckCircle2 className="size-3.5 text-primary" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Standard verification on port 80. Recommended for direct
                      public subdomains.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDnsProvider("cloudflare")}
                    className={cn(
                      "w-full cursor-pointer space-y-1 rounded-md border p-3 text-left transition-all",
                      dnsProvider === "cloudflare"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Cloudflare DNS-01 Challenge
                      </span>
                      {dnsProvider === "cloudflare" && (
                        <CheckCircle2 className="size-3.5 text-primary" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Required for Wildcard Certificates (
                      <code>*.gettako.dev</code>) via Cloudflare API.
                    </p>
                  </button>
                </div>

                {dnsProvider === "cloudflare" && (
                  <Field
                    data-invalid={Boolean(errors.cloudflareToken)}
                    className="max-w-md pt-2"
                  >
                    <FieldLabel className="text-xs">
                      Cloudflare API Token
                    </FieldLabel>
                    <Input
                      type="password"
                      value={cloudflareToken}
                      onChange={(e) => {
                        setCloudflareToken(e.target.value)
                        clearError("cloudflareToken")
                      }}
                      placeholder="Enter Cloudflare Zone:DNS API Token"
                      aria-invalid={Boolean(errors.cloudflareToken)}
                      aria-describedby={
                        errors.cloudflareToken
                          ? "cloudflare-token-error"
                          : undefined
                      }
                      className="font-mono text-xs"
                    />
                    <FieldError
                      id="cloudflare-token-error"
                      className="text-[11px]"
                    >
                      {errors.cloudflareToken}
                    </FieldError>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Token permissions required: <code>Zone:DNS:Edit</code> and{" "}
                      <code>Zone:Zone:Read</code>.
                    </p>
                  </Field>
                )}
              </div>

              {/* Certificate Telemetry Summary */}
              <div className="grid grid-cols-1 gap-3 pt-1 text-xs sm:grid-cols-3">
                <div className="space-y-1 rounded-lg border border-border bg-muted/10 p-3">
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    CERT RESOLVER
                  </span>
                  <div className="font-mono font-semibold text-foreground">
                    Traefik Let&apos;s Encrypt
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Port 80 / 443 Ingress
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border border-border bg-muted/10 p-3">
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    AUTO-RENEWAL PERIOD
                  </span>
                  <div className="font-mono font-semibold text-foreground">
                    Every 60 Days
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Zero downtime renewal
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border border-border bg-muted/10 p-3">
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    ACTIVE CHALLENGE
                  </span>
                  <div className="font-mono font-semibold text-foreground">
                    {dnsProvider === "cloudflare"
                      ? "Cloudflare DNS-01"
                      : "HTTP-01 Challenge"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {dnsProvider === "cloudflare"
                      ? "Supports wildcard certificates"
                      : "Requires open HTTP port"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-border pt-3">
              <Button type="submit" size="sm" className="gap-1.5 text-xs">
                {saved ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span>Domain Settings Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3" />
                    <span>Save Domain Settings</span>
                  </>
                )}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </div>
    </div>
  )
}
