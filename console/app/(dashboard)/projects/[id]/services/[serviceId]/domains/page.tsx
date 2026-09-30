"use client"

import * as React from "react"
import {
  Globe,
  Plus,
  Copy,
  Check,
  ArrowClockwise,
  Trash,
  CircleNotchIcon,
  ArrowSquareOut,
  ShieldCheck,
  ShieldWarning,
  WarningCircle,
  HardDrives,
  Lock,
  PencilSimple,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorCard } from "@/components/states/error-card"
import { AddDomainDialog } from "@/components/services/add-domain-dialog"
import { useService } from "@/components/services/service-context"
import { api, type Domain } from "@/lib/api"

export default function ServiceDomainsPage() {
  const { service, serviceId, projectId, showToast } = useService()

  const [domains, setDomains] = React.useState<Domain[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingDomain, setEditingDomain] = React.useState<Domain | null>(null)

  // Tracking in-flight actions
  const [checkingDomain, setCheckingDomain] = React.useState<string | null>(
    null
  )
  const [deletingDomain, setDeletingDomain] = React.useState<string | null>(
    null
  )

  const loadDomains = React.useCallback(async () => {
    if (!serviceId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.services.listDomains(serviceId)
      setDomains(data)
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to load domains.")
      )
    } finally {
      setIsLoading(false)
    }
  }, [serviceId])

  React.useEffect(() => {
    loadDomains()
  }, [loadDomains])

  const handleCheckSsl = async (domainName: string) => {
    setCheckingDomain(domainName)
    try {
      const updated = await api.services.checkDomainSsl(serviceId, domainName)
      setDomains((prev) =>
        prev.map((d) => (d.domain === domainName ? updated : d))
      )
      if (updated.ssl_status === "active") {
        showToast("success", `SSL active for ${domainName}.`)
      } else {
        showToast(
          "error",
          `SSL status: ${updated.ssl_status}. Verify DNS A record.`
        )
      }
    } catch {
      showToast("error", `Failed to check SSL for ${domainName}.`)
    } finally {
      setCheckingDomain(null)
    }
  }

  const handleDeleteDomain = async (domainName: string) => {
    setDeletingDomain(domainName)
    try {
      await api.services.deleteDomain(serviceId, domainName)
      setDomains((prev) => prev.filter((d) => d.domain !== domainName))
      showToast("success", `Domain "${domainName}" deleted successfully.`)
    } catch {
      showToast("error", `Failed to delete domain "${domainName}".`)
    } finally {
      setDeletingDomain(null)
    }
  }

  const handleDomainSaved = (savedDomain: Domain) => {
    setDomains((prev) => {
      const exists = prev.some((d) => d.domain === savedDomain.domain)
      let next: Domain[]
      if (exists) {
        next = prev.map((d) =>
          d.domain === savedDomain.domain ? savedDomain : d
        )
      } else {
        next = [...prev, savedDomain]
      }

      // If saved domain is canonical, unset is_canonical on other domains of the same service
      if (savedDomain.is_canonical) {
        next = next.map((d) => {
          if (
            d.domain !== savedDomain.domain &&
            d.service_id === savedDomain.service_id
          ) {
            return { ...d, is_canonical: false }
          }
          return d
        })
      }
      return next
    })

    showToast(
      "success",
      editingDomain
        ? `Domain "${savedDomain.domain}" updated successfully.`
        : `Domain "${savedDomain.domain}" added successfully.`
    )
    setEditingDomain(null)
  }

  const openAddDialog = () => {
    setEditingDomain(null)
    setDialogOpen(true)
  }

  const openEditDialog = (domain: Domain) => {
    setEditingDomain(domain)
    setDialogOpen(true)
  }

  const serverIp = service?.server?.host || "127.0.0.1"

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <LoadingSkeleton variant="table" rows={3} />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorCard
        title="Failed to Load Domains"
        message={error.message}
        onRetry={loadDomains}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Tab Header Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Custom Domains & Ingress
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure host and path routing rules, 301 redirects, HTTP Basic
            Auth, and Let's Encrypt TLS certificates.
          </p>
        </div>

        <Button
          variant="default"
          onClick={openAddDialog}
          className="cursor-pointer gap-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Add Domain</span>
        </Button>
      </div>

      {/* Target Server Info Pill */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        <HardDrives
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span>Target Server IP for DNS A Record:</span>
        <code className="rounded border border-border bg-muted px-2 py-0.5 font-mono font-semibold text-foreground">
          {serverIp}
        </code>
      </div>

      {/* Domains List */}
      {domains.length === 0 ? (
        <EmptyState
          title="No domains configured"
          description="Route public web traffic through Traefik by adding your first custom domain."
          action={{
            label: "Add Domain",
            onClick: openAddDialog,
          }}
          icon={
            <Globe
              className="size-6 text-muted-foreground"
              aria-hidden="true"
            />
          }
        />
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {domains.map((domain) => {
            const isChecking = checkingDomain === domain.domain
            const isDeleting = deletingDomain === domain.domain

            return (
              <div
                key={domain.id}
                className="flex flex-col justify-between gap-4 p-4 transition-colors hover:bg-muted/30 lg:flex-row lg:items-center"
              >
                {/* Left: Domain identity, path, redirects, target, badges */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Globe
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <a
                      href={`https://${domain.domain}${domain.path_prefix || ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex cursor-pointer items-center gap-1 font-mono text-sm font-semibold text-foreground hover:underline"
                    >
                      <span>{domain.domain}</span>
                      <ArrowSquareOut
                        className="size-3 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </a>

                    <CopyButton
                      text={domain.domain}
                      size="xs"
                      showIconOnly
                      title="Copy domain name"
                      aria-label={`Copy ${domain.domain}`}
                    />

                    {domain.is_canonical && (
                      <span className="inline-flex items-center rounded bg-primary px-2 py-0.5 text-2xs font-semibold text-primary-foreground">
                        Canonical
                      </span>
                    )}

                    {/* SSL Status Pill */}
                    {domain.ssl_resolver === "none" ? (
                      <span className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                        Plain HTTP
                      </span>
                    ) : (
                      <>
                        {domain.ssl_status === "active" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-status-healthy-border bg-status-healthy-bg px-2.5 py-0.5 text-xs font-medium text-status-healthy-text">
                            <ShieldCheck
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            <span>Active</span>
                          </span>
                        )}

                        {domain.ssl_status === "pending" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-status-queued-border bg-status-queued-bg px-2.5 py-0.5 text-xs font-medium text-status-queued-text">
                            <ShieldWarning
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            <span>Pending DNS</span>
                          </span>
                        )}

                        {domain.ssl_status === "error" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-status-failed-border bg-status-failed-bg px-2.5 py-0.5 text-xs font-medium text-status-failed-text">
                            <WarningCircle
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            <span>Error</span>
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Routing tags and attributes */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Target Service & Port */}
                    <span className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 font-mono text-2xs text-muted-foreground">
                      {domain.service_name
                        ? `Target: ${domain.service_name} (port ${domain.port})`
                        : `Port: ${domain.port}`}
                    </span>

                    {/* Path Prefix */}
                    {domain.path_prefix && (
                      <span className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 font-mono text-2xs text-muted-foreground">
                        Path: {domain.path_prefix}
                        {domain.strip_prefix ? " (strip)" : ""}
                      </span>
                    )}

                    {/* 301 Redirect mode */}
                    {domain.redirect_mode === "www_to_non_www" && (
                      <span className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                        301: www -&gt; non-www
                      </span>
                    )}
                    {domain.redirect_mode === "non_www_to_www" && (
                      <span className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                        301: non-www -&gt; www
                      </span>
                    )}

                    {/* Basic Auth */}
                    {domain.auth_enabled && (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-700 dark:text-amber-300">
                        <Lock className="size-3" aria-hidden="true" />
                        <span>
                          Basic Auth ({domain.auth_user || "enabled"})
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions (Edit, Check SSL, Delete) */}
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(domain)}
                    className="cursor-pointer gap-1.5"
                    aria-label={`Edit routing for ${domain.domain}`}
                  >
                    <PencilSimple
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span>Edit</span>
                  </Button>

                  {domain.ssl_resolver !== "none" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCheckSsl(domain.domain)}
                      disabled={isChecking}
                      className="cursor-pointer gap-1.5"
                    >
                      {isChecking ? (
                        <CircleNotchIcon
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ArrowClockwise
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                      <span>Check SSL</span>
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDomain(domain.domain)}
                    disabled={isDeleting}
                    className="cursor-pointer text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete domain ${domain.domain}`}
                  >
                    {isDeleting ? (
                      <CircleNotchIcon
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Trash className="size-3.5" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Domain Dialog */}
      <AddDomainDialog
        serviceId={serviceId}
        projectId={projectId}
        defaultPort={service?.internal_port}
        serverIp={serverIp}
        initialData={editingDomain}
        open={dialogOpen}
        onOpenChange={(isOpen) => {
          setDialogOpen(isOpen)
          if (!isOpen) setEditingDomain(null)
        }}
        onDomainSaved={handleDomainSaved}
      />
    </div>
  )
}
