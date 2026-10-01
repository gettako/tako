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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  CircleNotchIcon,
  GlobeIcon,
  InfoIcon,
  PlusIcon,
  LockIcon,
  EyeIcon,
  EyeSlashIcon,
  CaretDownIcon,
  CheckIcon,
  ArrowsClockwiseIcon,
} from "@phosphor-icons/react"
import { api, type Domain, type Service } from "@/lib/api"

export interface AddDomainFormProps {
  serviceId: string
  projectId?: string
  defaultPort?: number
  serverIp?: string
  initialData?: Domain | null
  onSuccess: (savedDomain: Domain) => void
  onCancel: () => void
}

const DOMAIN_REGEX =
  /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/

export function AddDomainForm({
  serviceId,
  projectId,
  defaultPort = 3000,
  serverIp = "127.0.0.1",
  initialData,
  onSuccess,
  onCancel,
}: AddDomainFormProps) {
  const isEditing = Boolean(initialData)

  const [domainInput, setDomainInput] = React.useState(
    initialData?.domain || ""
  )
  const [targetServiceId, setTargetServiceId] = React.useState(
    initialData?.service_id || serviceId
  )
  const [portInput, setPortInput] = React.useState(
    String(initialData?.port || defaultPort)
  )
  const [pathPrefixInput, setPathPrefixInput] = React.useState(
    initialData?.path_prefix || ""
  )
  const [stripPrefix, setStripPrefix] = React.useState(
    initialData?.strip_prefix ?? false
  )
  const [isCanonical, setIsCanonical] = React.useState(
    initialData?.is_canonical ?? false
  )
  const [redirectMode, setRedirectMode] = React.useState<
    "none" | "www_to_non_www" | "non_www_to_www"
  >(initialData?.redirect_mode || "none")

  // HTTP Basic Auth
  const [authEnabled, setAuthEnabled] = React.useState(
    initialData?.auth_enabled ?? false
  )
  const [authUser, setAuthUser] = React.useState(initialData?.auth_user || "")
  const [authPassword, setAuthPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)

  // Advanced Options
  const [sslResolver, setSslResolver] = React.useState<"letsencrypt" | "none">(
    initialData?.ssl_resolver || "letsencrypt"
  )
  const [entrypoints, setEntrypoints] = React.useState(
    initialData?.entrypoints || "web,websecure"
  )
  const [advancedOpen, setAdvancedOpen] = React.useState(false)

  const [availableServices, setAvailableServices] = React.useState<Service[]>(
    []
  )
  const [isLoadingServices, setIsLoadingServices] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const availableServiceItems = React.useMemo(
    () =>
      availableServices.map((svc) => ({
        value: svc.id,
        label: `${svc.name} (${svc.service_type})`,
      })),
    [availableServices]
  )

  // Fetch project services for target picker if projectId is available
  React.useEffect(() => {
    if (!projectId) return
    let isMounted = true
    setIsLoadingServices(true)
    api.projects
      .get(projectId)
      .then((projectDetail) => {
        if (isMounted && projectDetail.services) {
          setAvailableServices(projectDetail.services)
        }
      })
      .catch(() => {
        // Fallback: keep availableServices empty
      })
      .finally(() => {
        if (isMounted) setIsLoadingServices(false)
      })
    return () => {
      isMounted = false
    }
  }, [projectId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedDomain = domainInput.trim().toLowerCase()
    if (!trimmedDomain) {
      setError("Domain name is required.")
      return
    }

    if (!DOMAIN_REGEX.test(trimmedDomain)) {
      setError("Please enter a valid domain format (e.g. app.example.com).")
      return
    }

    const portNum = parseInt(portInput, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError("Container port must be a valid number between 1 and 65535.")
      return
    }

    let sanitizedPath = pathPrefixInput.trim()
    if (sanitizedPath && !sanitizedPath.startsWith("/")) {
      sanitizedPath = `/${sanitizedPath}`
    }

    if (authEnabled) {
      if (!authUser.trim()) {
        setError(
          "Basic Auth username is required when authentication is enabled."
        )
        return
      }
      if (!isEditing && !authPassword) {
        setError(
          "Basic Auth password is required when enabling authentication."
        )
        return
      }
    }

    setIsSubmitting(true)
    try {
      if (isEditing && initialData) {
        const updated = await api.services.updateDomain(
          initialData.service_id || serviceId,
          initialData.domain,
          {
            service_id: targetServiceId,
            port: portNum,
            path_prefix: sanitizedPath,
            strip_prefix: stripPrefix,
            is_canonical: isCanonical,
            redirect_mode: redirectMode,
            auth_enabled: authEnabled,
            auth_user: authUser.trim(),
            ...(authPassword ? { auth_password: authPassword } : {}),
            ssl_resolver: sslResolver,
            entrypoints: entrypoints.trim() || "web,websecure",
          }
        )
        onSuccess(updated)
      } else {
        const created = await api.services.addDomain(
          targetServiceId || serviceId,
          {
            domain: trimmedDomain,
            service_id: targetServiceId,
            port: portNum,
            path_prefix: sanitizedPath,
            strip_prefix: stripPrefix,
            is_canonical: isCanonical,
            redirect_mode: redirectMode,
            auth_enabled: authEnabled,
            auth_user: authUser.trim(),
            auth_password: authPassword,
            ssl_resolver: sslResolver,
            entrypoints: entrypoints.trim() || "web,websecure",
          }
        )
        onSuccess(created)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save domain configuration."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <DialogHeader className="border-b border-border pr-8 pb-3 text-left">
        <DialogTitle>
          {isEditing ? "Edit Domain Routing" : "Add Custom Domain"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Update host routing rules, target service container, and ingress middleware."
            : "Route public web traffic through Traefik and provision automated Let's Encrypt SSL."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        {/* Domain name field */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="domain-name"
            className="text-xs font-medium text-foreground"
          >
            Domain Name
          </label>
          <Input
            id="domain-name"
            type="text"
            placeholder="api.example.com"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            disabled={isSubmitting || isEditing}
            className="font-mono text-xs"
            autoFocus={!isEditing}
          />
          <span className="text-2xs text-muted-foreground">
            Fully qualified domain name (subdomain or root apex domain).
          </span>
        </div>

        {/* Target Service & Container Port */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="target-service"
              className="text-xs font-medium text-foreground"
            >
              Target Service
            </label>
            {availableServices.length > 0 ? (
              <Select
                items={availableServiceItems}
                value={targetServiceId}
                onValueChange={(val) => {
                  if (val) {
                    setTargetServiceId(val)
                    const svc = availableServices.find((s) => s.id === val)
                    if (svc?.internal_port && !isEditing) {
                      setPortInput(String(svc.internal_port))
                    }
                  }
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger id="target-service" className="w-full text-xs">
                  <SelectValue placeholder="Select target service">
                    {(val: string | null) => {
                      if (!val) return "Select target service"
                      const svc = availableServices.find((s) => s.id === val)
                      return svc ? `${svc.name} (${svc.service_type})` : val
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableServices.map((svc) => (
                    <SelectItem key={svc.id} value={svc.id}>
                      <span className="font-medium">{svc.name}</span>
                      <span className="ml-1.5 font-mono text-2xs text-muted-foreground">
                        ({svc.service_type})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="target-service"
                type="text"
                value={targetServiceId}
                disabled
                className="bg-muted/40 font-mono text-xs"
              />
            )}
            <span className="text-2xs text-muted-foreground">
              Container that receives traffic for this rule.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="container-port"
              className="text-xs font-medium text-foreground"
            >
              Container Port
            </label>
            <Input
              id="container-port"
              type="number"
              min={1}
              max={65535}
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              disabled={isSubmitting}
              className="font-mono text-xs"
            />
            <span className="text-2xs text-muted-foreground">
              Target port (e.g. 3000).
            </span>
          </div>
        </div>

        {/* Path-Based Routing */}
        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">
              Path-Based Routing
            </span>
            <span className="text-2xs text-muted-foreground">
              Optionally route requests matching a specific path prefix to this
              service.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="path-prefix"
                className="text-xs font-medium text-foreground"
              >
                Path Prefix
              </label>
              <Input
                id="path-prefix"
                type="text"
                placeholder="/api"
                value={pathPrefixInput}
                onChange={(e) => setPathPrefixInput(e.target.value)}
                disabled={isSubmitting}
                className="font-mono text-xs"
              />
              <span className="text-2xs text-muted-foreground">
                Matches PathPrefix (e.g. /api or /v1).
              </span>
            </div>

            <div className="flex flex-col justify-center pt-2 sm:pt-4">
              <label
                htmlFor="strip-prefix-checkbox"
                className="flex cursor-pointer items-center gap-2 text-xs text-foreground select-none"
              >
                <Checkbox
                  id="strip-prefix-checkbox"
                  checked={stripPrefix}
                  onCheckedChange={(checked) =>
                    setStripPrefix(Boolean(checked))
                  }
                  disabled={isSubmitting || !pathPrefixInput.trim()}
                />
                <div className="flex flex-col">
                  <span className="font-medium">Strip Prefix</span>
                  <span className="text-2xs text-muted-foreground">
                    Removes prefix before forwarding.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Canonical Domain & Redirects */}
        <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3">
          <label
            htmlFor="canonical-checkbox"
            className="flex cursor-pointer items-center gap-2.5 text-xs text-foreground select-none"
          >
            <Checkbox
              id="canonical-checkbox"
              checked={isCanonical}
              onCheckedChange={(checked) => setIsCanonical(Boolean(checked))}
              disabled={isSubmitting}
            />
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">
                Designate as Canonical Domain
              </span>
              <span className="text-2xs text-muted-foreground">
                Primary domain identity for this service container.
              </span>
            </div>
          </label>

          <div className="flex flex-col gap-1.5 border-t border-border pt-1">
            <label
              htmlFor="redirect-mode"
              className="text-xs font-medium text-foreground"
            >
              Automated 301 Redirects
            </label>
            <Select
              value={redirectMode}
              onValueChange={(val) => {
                if (
                  val === "none" ||
                  val === "www_to_non_www" ||
                  val === "non_www_to_www"
                ) {
                  setRedirectMode(val)
                }
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger id="redirect-mode" className="w-full text-xs">
                <SelectValue placeholder="Select redirect mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  No redirect (serve directly)
                </SelectItem>
                <SelectItem value="www_to_non_www">
                  Redirect www to non-www (301 Permanent)
                </SelectItem>
                <SelectItem value="non_www_to_www">
                  Redirect non-www to www (301 Permanent)
                </SelectItem>
              </SelectContent>
            </Select>
            <span className="text-2xs text-muted-foreground">
              Traefik issues a 301 redirect while preserving request paths and
              query parameters.
            </span>
          </div>
        </div>

        {/* HTTP Basic Auth Middleware */}
        <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3">
          <label
            htmlFor="auth-enabled-checkbox"
            className="flex cursor-pointer items-center gap-2.5 text-xs text-foreground select-none"
          >
            <Checkbox
              id="auth-enabled-checkbox"
              checked={authEnabled}
              onCheckedChange={(checked) => setAuthEnabled(Boolean(checked))}
              disabled={isSubmitting}
            />
            <div className="flex flex-col">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <LockIcon
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                Enable Basic Auth Protection
              </span>
              <span className="text-2xs text-muted-foreground">
                Requires browser username and password to access this endpoint.
              </span>
            </div>
          </label>

          {authEnabled && (
            <div className="grid grid-cols-1 gap-3 border-t border-border pt-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="auth-username"
                  className="text-xs font-medium text-foreground"
                >
                  Username
                </label>
                <Input
                  id="auth-username"
                  type="text"
                  placeholder="admin"
                  value={authUser}
                  onChange={(e) => setAuthUser(e.target.value)}
                  disabled={isSubmitting}
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="auth-password"
                  className="text-xs font-medium text-foreground"
                >
                  Password{" "}
                  {isEditing && (
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={
                      isEditing
                        ? "Leave blank to keep current"
                        : "Enter password"
                    }
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="pr-9 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <EyeIcon className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Advanced Options */}
        <Collapsible
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          className="rounded-md border border-border bg-card p-3"
        >
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-xs font-semibold text-foreground">
            <span>Advanced Ingress Options</span>
            <CaretDownIcon
              className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
                advancedOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </CollapsibleTrigger>

          <CollapsibleContent className="flex flex-col gap-3 pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="ssl-resolver"
                  className="text-xs font-medium text-foreground"
                >
                  SSL Certificate Resolver
                </label>
                <Select
                  value={sslResolver}
                  onValueChange={(val) => {
                    if (val === "letsencrypt" || val === "none") {
                      setSslResolver(val)
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="ssl-resolver" className="w-full text-xs">
                    <SelectValue placeholder="Select SSL resolver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="letsencrypt">
                      Automated Let's Encrypt (HTTPS)
                    </SelectItem>
                    <SelectItem value="none">
                      Plain HTTP / External Proxy
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="entrypoints"
                  className="text-xs font-medium text-foreground"
                >
                  Traefik Entrypoints
                </label>
                <Input
                  id="entrypoints"
                  type="text"
                  placeholder="web,websecure"
                  value={entrypoints}
                  onChange={(e) => setEntrypoints(e.target.value)}
                  disabled={isSubmitting}
                  className="font-mono text-xs"
                />
                <span className="text-2xs text-muted-foreground">
                  Comma-separated entrypoint names.
                </span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* DNS Guidance Box */}
        <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/60 p-3 text-xs">
          <InfoIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-foreground">
              DNS Configuration Required
            </span>
            <p className="leading-relaxed text-muted-foreground">
              Create an{" "}
              <code className="font-mono font-semibold text-foreground">A</code>{" "}
              record in your DNS provider pointing this domain to server IP{" "}
              <code className="rounded border border-border bg-background px-1.5 py-0.5 font-mono font-semibold text-foreground">
                {serverIp}
              </code>
              .
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-status-failed-border bg-status-failed-bg p-2.5 text-xs text-status-failed-text"
          >
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={isSubmitting}
          className="cursor-pointer gap-2"
        >
          {isSubmitting ? (
            <CircleNotchIcon
              className="size-4 animate-spin"
              aria-hidden="true"
            />
          ) : isEditing ? (
            <CheckIcon className="size-4" aria-hidden="true" />
          ) : (
            <PlusIcon className="size-4" aria-hidden="true" />
          )}
          <span>{isEditing ? "Save Changes" : "Add Domain"}</span>
        </Button>
      </div>
    </form>
  )
}

export function AddDomainDialog({
  serviceId,
  projectId,
  defaultPort,
  serverIp,
  initialData,
  open,
  onOpenChange,
  onDomainSaved,
  onDomainAdded,
}: {
  serviceId: string
  projectId?: string
  defaultPort?: number
  serverIp?: string
  initialData?: Domain | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDomainSaved?: (domain: Domain) => void
  onDomainAdded?: (domain: Domain) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <AddDomainForm
          serviceId={serviceId}
          projectId={projectId}
          defaultPort={defaultPort}
          serverIp={serverIp}
          initialData={initialData}
          onSuccess={(saved) => {
            if (onDomainSaved) {
              onDomainSaved(saved)
            } else if (onDomainAdded) {
              onDomainAdded(saved)
            }
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
