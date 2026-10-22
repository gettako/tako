"use client"

import * as React from "react"
import {
  AlertTriangle,
  Check,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  Plus,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react"
import { z } from "zod"

import {
  ServiceSettingsTabs,
  type SettingsSection,
} from "@/components/services/service-settings-tabs"
import { Button } from "@/components/ui/button"
import { CodeEditor } from "@/components/ui/code-editor"
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
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select"
import { usePlatformData } from "@/context/platform-data-context"
import { apiPost } from "@/lib/api"
import { useZodForm } from "@/hooks/use-zod-form"
import { getServiceContainers, resolveDomainContainer } from "@/lib/container"
import {
  domainEntryPoint,
  domainInternalPath,
  domainUrl,
  normalizeHost,
  normalizePath,
} from "@/lib/domain"
import { EDGE_ENTRYPOINTS, getEdgeEntryPoint } from "@/lib/edge"
import { isValidHostname } from "@/lib/validation"
import {
  ClusterNode,
  ProjectService,
  ServiceDomain,
  ServiceResourceSpecs,
} from "@/types/platform"
import { cn } from "@/lib/utils"

interface ServiceSettingsViewProps {
  service: ProjectService
  nodes: ClusterNode[]
}

const RESTART_POLICY_OPTIONS: SelectOption[] = [
  {
    value: "always",
    label: "always",
    description: "Always restart container upon exit",
  },
  {
    value: "unless-stopped",
    label: "unless-stopped",
    description: "Restart unless manually stopped",
  },
  {
    value: "on-failure",
    label: "on-failure",
    description: "Restart only if container exits with non-zero error",
  },
]

const OOM_OPTIONS: SelectOption[] = [
  {
    value: "kill",
    label: "Kill container and restart",
    description: "Default cgroup OOM action upon memory exhaustion",
  },
  {
    value: "throttle",
    label: "Throttle execution & alert",
    description: "Constrain CPU without terminating container",
  },
]

const PROTOCOL_OPTIONS: SelectOption[] = [
  { value: "tcp", label: "TCP" },
  { value: "udp", label: "UDP" },
]

const EDGE_ENTRYPOINT_OPTIONS: SelectOption[] = EDGE_ENTRYPOINTS.map(
  (entryPoint) => ({
    value: entryPoint.name,
    label: entryPoint.name,
    description: entryPoint.description,
    badge: entryPoint.tls ? "TLS" : "HTTP",
  })
)

const domainRouteSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1, "Domain name is required.")
    .refine((value) => {
      const host = normalizeHost(value)
      if (!host) return false
      return isValidHostname(host.split(":")[0])
    }, "Enter a valid domain name."),
  path: z
    .string()
    .trim()
    .min(1, "Public path is required.")
    .refine((value) => !/\s/.test(value), "Path cannot contain spaces.")
    .refine(
      (value) => !value.includes(".."),
      "Path cannot contain parent directory segments."
    ),
  internalPath: z
    .string()
    .trim()
    .min(1, "Internal path is required.")
    .refine((value) => !/\s/.test(value), "Path cannot contain spaces.")
    .refine(
      (value) => !value.includes(".."),
      "Path cannot contain parent directory segments."
    ),
  container: z.string().trim().min(1, "Select a target container."),
  port: z.string().trim().min(1, "Select a target port."),
  entryPoint: z.string().trim().min(1, "Select an entry point."),
})

export function ServiceSettingsView({
  service,
  nodes,
}: ServiceSettingsViewProps) {
  const { updateService, deleteService, addAuditLog } = usePlatformData()

  const serviceContainers = getServiceContainers(service)
  const mainContainer =
    serviceContainers.find((container) => container.isMain) ??
    serviceContainers[0]
  const mainContainerPort = mainContainer?.ports[0]

  const [activeSection, setActiveSection] =
    React.useState<SettingsSection>("general")
  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null)

  // General state
  const [name, setName] = React.useState(service.name)
  const [slug, setSlug] = React.useState(service.slug)
  const [description, setDescription] = React.useState(service.description)
  const [targetNodeId, setTargetNodeId] = React.useState(service.targetNodeId)
  const [restartPolicy, setRestartPolicy] = React.useState(
    service.restartPolicy
  )
  const [gitBranch, setGitBranch] = React.useState(service.gitBranch)
  const [autoDeploy, setAutoDeploy] = React.useState(true)

  // Domains state
  const [domains, setDomains] = React.useState<ServiceDomain[]>(() => {
    return (
      service.domains || [
        {
          id: "dom-1",
          domain: `${service.slug}.edge.gettako.dev`,
          path: "/",
          internalPath: "/",
          entryPoint: "websecure",
          https: true,
          sslStatus: "active",
          targetContainer: mainContainer?.name,
          targetPort: mainContainerPort?.port ?? 443,
          targetProtocol: mainContainerPort?.protocol ?? "tcp",
          isPrimary: true,
          createdAt: "2026-09-12",
        },
      ]
    )
  })
  const [newDomainInput, setNewDomainInput] = React.useState("")
  const [newDomainPath, setNewDomainPath] = React.useState("/")
  const [newDomainInternalPath, setNewDomainInternalPath] = React.useState("/")
  const [newDomainContainer, setNewDomainContainer] = React.useState(
    mainContainer?.name ?? ""
  )
  const [newDomainPort, setNewDomainPort] = React.useState(
    String(mainContainerPort?.port ?? 443)
  )
  const [newDomainEntryPoint, setNewDomainEntryPoint] = React.useState("")
  const {
    errors: domainErrors,
    validate: validateDomain,
    clearError: clearDomainError,
    setErrors: setDomainErrors,
  } = useZodForm(domainRouteSchema)
  const [addDomainDialogOpen, setAddDomainDialogOpen] = React.useState(false)
  const [forceHttps, setForceHttps] = React.useState(true)
  const [http3Enabled, setHttp3Enabled] = React.useState(true)

  const selectedDomainContainer =
    serviceContainers.find(
      (container) => container.name === newDomainContainer
    ) ?? mainContainer
  const selectedDomainPorts = selectedDomainContainer?.ports ?? []
  const selectedDomainPort =
    selectedDomainPorts.find((port) => String(port.port) === newDomainPort) ??
    selectedDomainPorts[0]
  const selectedEdgeEntryPoint = getEdgeEntryPoint(newDomainEntryPoint)
  const newDomainHttps = selectedEdgeEntryPoint?.tls ?? false

  const domainContainerOptions: SelectOption[] = serviceContainers.map(
    (container) => ({
      value: container.name,
      label: container.name,
      description: `${container.ports.length} exposed port${container.ports.length === 1 ? "" : "s"}`,
      badge: container.isMain ? "main" : undefined,
    })
  )

  const domainPortOptions: SelectOption[] = selectedDomainPorts.map((port) => ({
    value: String(port.port),
    label: `${port.port} / ${port.protocol}`,
    description: port.name ? `${port.name} listener` : undefined,
  }))

  // Specs state (CPU & RAM)
  const [specs, setSpecs] = React.useState<ServiceResourceSpecs>(() => {
    return (
      service.resourceSpecs || {
        cpuReservation: 0.25,
        cpuLimit: 1.5,
        memoryReservationMb: 256,
        memoryLimitMb: service.metrics.memoryLimitMb || 1024,
        replicas: 2,
        oomPolicy: "kill",
        swapMb: 512,
      }
    )
  })

  // Env vars state
  const [envMode, setEnvMode] = React.useState<"kv" | "raw">("kv")
  const [envVars, setEnvVars] = React.useState(service.envVars || [])
  const [envRawText, setEnvRawText] = React.useState(() =>
    (service.envVars || []).map((e) => `${e.key}=${e.value}`).join("\n")
  )
  const [revealedSecrets, setRevealedSecrets] = React.useState<
    Record<number, boolean>
  >({})

  // Networking state
  const [portMappings, setPortMappings] = React.useState(
    service.portMappings || []
  )
  const [newHostPort, setNewHostPort] = React.useState("")
  const [newContainerPort, setNewContainerPort] = React.useState("")
  const [newProtocol, setNewProtocol] = React.useState<"tcp" | "udp">("tcp")
  const [isPublicIngress, setIsPublicIngress] = React.useState(true)

  // Health checks state
  const [healthEnabled, setHealthEnabled] = React.useState(
    service.healthCheck?.enabled ?? true
  )
  const [healthPath, setHealthPath] = React.useState(
    service.healthCheck?.path || "/healthz"
  )
  const [healthPort, setHealthPort] = React.useState(
    service.healthCheck?.port?.toString() ||
      service.portMappings[0]?.container?.toString() ||
      "8443"
  )
  const [healthInterval, setHealthInterval] = React.useState(
    service.healthCheck?.intervalSec?.toString() || "10"
  )
  const [healthTimeout, setHealthTimeout] = React.useState(
    service.healthCheck?.timeoutSec?.toString() || "3"
  )
  const [healthRetries, setHealthRetries] = React.useState(
    service.healthCheck?.retries?.toString() || "3"
  )
  const [testingHealth, setTestingHealth] = React.useState(false)
  const [healthTestResult, setHealthTestResult] = React.useState<string | null>(
    null
  )

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("")

  const triggerFeedback = (section: string) => {
    setSaveSuccess(section)
    setTimeout(() => setSaveSuccess(null), 2500)
  }

  // Node options for select
  const nodeOptions: SelectOption[] = React.useMemo(() => {
    return nodes.map((n) => ({
      value: n.id,
      label: `${n.name} (${n.ipAddress})`,
      description: `${n.location.name} (${n.role})`,
    }))
  }, [nodes])

  const targetNode = nodes.find((n) => n.id === targetNodeId)

  // Handle saving General settings
  const handleSaveGeneral = () => {
    updateService(service.id, {
      name,
      slug,
      description,
      targetNodeId,
      restartPolicy: restartPolicy as
        | "always"
        | "on-failure"
        | "unless-stopped",
      gitBranch,
    })
    addAuditLog({
      action: "Service Settings Updated",
      category: "config",
      actor: { name: "operator@tako.internal", type: "user" },
      target: `${service.name} (${service.id})`,
      details: "Updated general settings, restart policy, and git tracking",
      status: "success",
    })
    triggerFeedback("general")
  }

  const resetNewDomainForm = () => {
    setNewDomainInput("")
    setNewDomainPath("/")
    setNewDomainInternalPath("/")
    setNewDomainContainer(mainContainer?.name ?? "")
    setNewDomainPort(String(mainContainerPort?.port ?? 443))
    setNewDomainEntryPoint("")
    setDomainErrors({})
  }

  // Handle adding custom domain
  const handleAddDomain = () => {
    const valid = validateDomain({
      domain: newDomainInput,
      path: newDomainPath,
      internalPath: newDomainInternalPath,
      container: newDomainContainer,
      port: newDomainPort,
      entryPoint: newDomainEntryPoint,
    })
    if (!valid) return

    const host = normalizeHost(newDomainInput)
    if (
      !host ||
      !selectedDomainContainer ||
      !selectedDomainPort ||
      !selectedEdgeEntryPoint
    ) {
      return
    }

    const path = normalizePath(newDomainPath)
    const internalPath = normalizePath(newDomainInternalPath)

    const newDom: ServiceDomain = {
      id: `dom-${Date.now().toString(36)}`,
      domain: host,
      path,
      internalPath,
      entryPoint: selectedEdgeEntryPoint.name,
      https: selectedEdgeEntryPoint.tls,
      sslStatus: selectedEdgeEntryPoint.tls ? "active" : "pending",
      targetContainer: selectedDomainContainer.name,
      targetPort: selectedDomainPort.port,
      targetProtocol: selectedDomainPort.protocol,
      isPrimary: domains.length === 0,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    const updated = [...domains, newDom]
    setDomains(updated)
    updateService(service.id, { domains: updated })
    resetNewDomainForm()
    setAddDomainDialogOpen(false)
    addAuditLog({
      action: "Domain Added",
      category: "config",
      actor: { name: "operator@tako.internal", type: "user" },
      target: `${service.name} (${service.id})`,
      details: `Routed ${domainUrl(newDom)} to ${selectedDomainContainer.name}:${selectedDomainPort.port}/${selectedDomainPort.protocol} via ${selectedEdgeEntryPoint.name}${selectedEdgeEntryPoint.tls ? " with TLS" : " over HTTP"}`,
      status: "success",
    })
    triggerFeedback("domains")
  }

  const handleDeleteDomain = (domId: string) => {
    const updated = domains.filter((d) => d.id !== domId)
    setDomains(updated)
    updateService(service.id, { domains: updated })
    triggerFeedback("domains")
  }

  // Handle saving Specs
  const handleSaveSpecs = () => {
    updateService(service.id, {
      resourceSpecs: specs,
      metrics: {
        ...service.metrics,
        memoryLimitMb: specs.memoryLimitMb,
      },
    })
    addAuditLog({
      action: "Resource Specs Updated",
      category: "config",
      actor: { name: "operator@tako.internal", type: "user" },
      target: `${service.name} (${service.id})`,
      details: `CPU limit: ${specs.cpuLimit} vCPU, Memory limit: ${specs.memoryLimitMb} MB, Replicas: ${specs.replicas}`,
      status: "success",
    })
    triggerFeedback("specs")
  }

  // Handle saving Env Vars
  const handleSaveEnv = () => {
    if (envMode === "raw") {
      const parsed = envRawText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => {
          const eq = l.indexOf("=")
          if (eq === -1) return { key: l, value: "" }
          let val = l.slice(eq + 1).trim()
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }
          return { key: l.slice(0, eq).trim(), value: val }
        })
        .filter((i) => i.key.length > 0)
      setEnvVars(parsed)
      updateService(service.id, { envVars: parsed })
    } else {
      updateService(service.id, { envVars })
      setEnvRawText(envVars.map((e) => `${e.key}=${e.value}`).join("\n"))
    }
    triggerFeedback("env")
  }

  // Handle adding port mapping
  const handleAddPort = () => {
    const host = Number.parseInt(newHostPort, 10)
    const container = Number.parseInt(newContainerPort, 10)
    if (!host || !container) return
    const updated = [
      ...portMappings,
      { host, container, protocol: newProtocol },
    ]
    setPortMappings(updated)
    updateService(service.id, { portMappings: updated })
    setNewHostPort("")
    setNewContainerPort("")
    triggerFeedback("networking")
  }

  const handleDeletePort = (idx: number) => {
    const updated = portMappings.filter((_, i) => i !== idx)
    setPortMappings(updated)
    updateService(service.id, { portMappings: updated })
    triggerFeedback("networking")
  }

  // Handle testing health check
  const handleTestHealth = async () => {
    setTestingHealth(true)
    setHealthTestResult(null)
    try {
      const res = await apiPost<{
        ok: boolean
        message: string
        latencyMs?: number
        status?: number
      }>(`/services/${service.id}/health-check/test`, {
        path: healthPath,
        port: Number.parseInt(healthPort, 10) || 80,
      })
      setHealthTestResult(res.message || "Health probe succeeded.")
    } catch (err: unknown) {
      setHealthTestResult(
        err instanceof Error
          ? err.message
          : "Health probe failed to contact container port."
      )
    } finally {
      setTestingHealth(false)
    }
  }

  // Handle saving health check
  const handleSaveHealth = () => {
    const check = {
      enabled: healthEnabled,
      path: healthPath,
      port: Number.parseInt(healthPort, 10) || 8443,
      intervalSec: Number.parseInt(healthInterval, 10) || 10,
      timeoutSec: Number.parseInt(healthTimeout, 10) || 3,
      retries: Number.parseInt(healthRetries, 10) || 3,
    }
    updateService(service.id, { healthCheck: check })
    triggerFeedback("health")
  }

  // Handle delete service
  const handleConfirmDelete = () => {
    if (deleteConfirmText !== service.name) return
    deleteService(service.id)
    addAuditLog({
      action: "Service Deleted",
      category: "config",
      actor: { name: "operator@tako.internal", type: "user" },
      target: `${service.name} (${service.id})`,
      details: "Service removed from project",
      status: "success",
    })
    window.location.assign(`/projects/${service.projectId}`)
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
      {/* Left Column: Vertical Sub-Menu (matching main platform settings width) */}
      <ServiceSettingsTabs
        activeSection={activeSection}
        onSelect={setActiveSection}
      />

      {/* Right Column: Settings Content Panels */}
      <main className="lg:col-span-8 xl:col-span-9">
        {/* Panel 1: General Settings */}
        {activeSection === "general" && (
          <div className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-bold text-foreground">
                General Service Settings
              </h2>
              <p className="text-xs text-muted-foreground">
                Identity, orchestration node target, and container runtime
                restart policy.
              </p>
            </div>

            <FieldGroup className="gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel className="text-xs">Service Name</FieldLabel>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xs"
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-xs">Service Slug</FieldLabel>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="font-mono text-xs"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel className="text-xs">Description</FieldLabel>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs"
                />
              </Field>

              <Field>
                <FieldLabel className="text-xs">Assigned Edge Node</FieldLabel>
                <SearchableSelect
                  value={targetNodeId}
                  onChange={(val) => setTargetNodeId(val)}
                  options={nodeOptions}
                  placeholder="Select edge node..."
                  searchPlaceholder="Search nodes..."
                />
              </Field>

              <Field>
                <FieldLabel className="text-xs">
                  Container Restart Policy
                </FieldLabel>
                <SearchableSelect
                  value={restartPolicy}
                  onChange={(val) => setRestartPolicy(val as any)}
                  options={RESTART_POLICY_OPTIONS}
                  placeholder="Select restart policy..."
                  searchPlaceholder="Search policy..."
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel className="text-xs">
                    Git Tracking Branch
                  </FieldLabel>
                  <Input
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    className="font-mono text-xs"
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-xs">
                    Auto Deploy on Git Push
                  </FieldLabel>
                  <div className="flex h-9 items-center justify-between rounded border border-border bg-muted/20 px-3">
                    <span className="font-mono text-xs text-foreground">
                      {autoDeploy ? "Enabled" : "Disabled"}
                    </span>
                    <button
                      type="button"
                      aria-label="Toggle auto deploy on git push"
                      onClick={() => setAutoDeploy(!autoDeploy)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                        autoDeploy ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs transition-transform",
                          autoDeploy ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </Field>
              </div>
            </FieldGroup>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="font-mono text-xs text-muted-foreground">
                Target Node: {targetNode?.name || targetNodeId}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveGeneral}
                className="gap-2 text-xs"
              >
                {saveSuccess === "general" ? (
                  <>
                    <Check className="size-3.5 text-white" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Panel 2: Domains & Routing */}
        {activeSection === "domains" && (
          <div className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-bold text-foreground">
                Domains & Edge Routing
              </h2>
              <p className="text-xs text-muted-foreground">
                Manage hostnames, public and internal paths, edge entrypoints,
                and TLS termination.
              </p>
            </div>

            {/* Domains List */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Configured Domains &amp; Routes
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {domains.length}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAddDomainDialogOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" />
                  <span>Add Domain</span>
                </Button>
              </div>

              <div className="space-y-2.5">
                {domains.map((dom) => {
                  const secure = dom.https ?? true
                  const path = normalizePath(dom.path)
                  const internalPath = domainInternalPath(dom)
                  const entryPoint = domainEntryPoint(dom)
                  const targetContainer = resolveDomainContainer(service, dom)
                  const url = domainUrl(dom)

                  return (
                    <div
                      key={dom.id}
                      className="flex flex-col gap-2 rounded border border-border bg-muted/20 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-mono text-xs font-bold text-foreground">
                            {url}
                          </span>
                          {dom.isPrimary && (
                            <span className="py-0.2 rounded bg-primary/10 px-1.5 font-mono text-[10px] font-semibold text-primary uppercase">
                              Primary
                            </span>
                          )}
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
                              secure
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {secure ? "HTTPS" : "HTTP"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                          <span
                            className={cn(
                              "flex items-center gap-1",
                              secure ? "text-emerald-500" : "text-amber-500"
                            )}
                          >
                            {secure ? (
                              <ShieldCheck className="size-3" />
                            ) : (
                              <ShieldOff className="size-3" />
                            )}
                            <span>
                              {secure ? "TLS active" : "TLS disabled"}
                            </span>
                          </span>
                          <span>Path: {path}</span>
                          <span>→ Internal: {internalPath}</span>
                          <span>Entry: {entryPoint}</span>
                          <span>
                            Container: {targetContainer?.name ?? "unset"}
                          </span>
                          <span>
                            Port: {dom.targetPort}/{dom.targetProtocol ?? "tcp"}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={dom.isPrimary && domains.length === 1}
                          onClick={() => handleDeleteDomain(dom.id)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete domain"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* DNS Setup Guide */}
            <div className="rounded border border-border/80 bg-card p-4">
              <span className="text-xs font-semibold text-foreground">
                DNS Configuration Instructions
              </span>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Point your domain registrar DNS records to the Tako edge cluster
                IP or CNAME target.
              </p>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Target Value</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr>
                      <td className="py-2 font-bold text-foreground">CNAME</td>
                      <td className="py-2 text-foreground">@ / subdomain</td>
                      <td className="py-2 font-bold text-primary">
                        edge.gettako.dev
                      </td>
                      <td className="py-2 font-semibold text-emerald-500">
                        Active
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-foreground">A</td>
                      <td className="py-2 text-foreground">@</td>
                      <td className="py-2 text-foreground">
                        {targetNode?.ipAddress || "142.250.190.46"}
                      </td>
                      <td className="py-2 font-semibold text-emerald-500">
                        Verified
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Edge Proxy Options */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-semibold text-foreground">
                Edge Proxy Configuration
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded border border-border p-3 text-xs">
                  <div>
                    <div className="font-medium text-foreground">
                      Force HTTPS Redirect
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Redirect HTTP port 80 to 443 TLS
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle force HTTPS redirect"
                    onClick={() => setForceHttps(!forceHttps)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                      forceHttps ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs transition-transform",
                        forceHttps ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded border border-border p-3 text-xs">
                  <div>
                    <div className="font-medium text-foreground">
                      HTTP/3 QUIC Acceleration
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Low-latency UDP edge transport
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle HTTP/3 QUIC acceleration"
                    onClick={() => setHttp3Enabled(!http3Enabled)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                      http3Enabled ? "bg-emerald-500" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs transition-transform",
                        http3Enabled ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel 3: Compute & Resources (Spec CPU & RAM per container) */}
        {activeSection === "specs" && (
          <div className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-bold text-foreground">
                Compute Specs (CPU & RAM per Container)
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure resource reservations, hard upper limits, horizontal
                replica count, and OOM killer policies.
              </p>
            </div>

            <div className="space-y-5">
              {/* CPU Limits */}
              <div className="space-y-3 rounded border border-border/80 bg-muted/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="size-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      CPU Allocation per Container
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-primary">
                    Limit: {specs.cpuLimit} vCPU
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel className="text-xs">
                      CPU Reservation (vCPU)
                    </FieldLabel>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="16"
                      value={specs.cpuReservation}
                      onChange={(e) =>
                        setSpecs({
                          ...specs,
                          cpuReservation:
                            Number.parseFloat(e.target.value) || 0.1,
                        })
                      }
                      className="font-mono text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Guaranteed minimum compute resources
                    </span>
                  </Field>

                  <Field>
                    <FieldLabel className="text-xs">
                      CPU Hard Limit (vCPU)
                    </FieldLabel>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.25"
                      max="32"
                      value={specs.cpuLimit}
                      onChange={(e) =>
                        setSpecs({
                          ...specs,
                          cpuLimit: Number.parseFloat(e.target.value) || 0.5,
                        })
                      }
                      className="font-mono text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Maximum throttle boundary on host cores
                    </span>
                  </Field>
                </div>
              </div>

              {/* RAM Limits */}
              <div className="space-y-3 rounded border border-border/80 bg-muted/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="size-4 text-emerald-500" />
                    <span className="text-xs font-bold text-foreground">
                      Memory (RAM) Allocation per Container
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-emerald-500">
                    Limit: {specs.memoryLimitMb} MB
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel className="text-xs">
                      Memory Reservation (MB)
                    </FieldLabel>
                    <Input
                      type="number"
                      step="64"
                      min="64"
                      max="65536"
                      value={specs.memoryReservationMb}
                      onChange={(e) =>
                        setSpecs({
                          ...specs,
                          memoryReservationMb:
                            Number.parseInt(e.target.value, 10) || 128,
                        })
                      }
                      className="font-mono text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Soft memory limit committed by host cgroup
                    </span>
                  </Field>

                  <Field>
                    <FieldLabel className="text-xs">
                      Memory Hard Limit (MB)
                    </FieldLabel>
                    <Input
                      type="number"
                      step="128"
                      min="128"
                      max="65536"
                      value={specs.memoryLimitMb}
                      onChange={(e) =>
                        setSpecs({
                          ...specs,
                          memoryLimitMb:
                            Number.parseInt(e.target.value, 10) || 512,
                        })
                      }
                      className="font-mono text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      OOM killer trigger threshold
                    </span>
                  </Field>
                </div>
              </div>

              {/* Replicas & OOM Behavior using shadcn Field and SearchableSelect */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel className="text-xs">
                    Container Replicas (Instances)
                  </FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={specs.replicas}
                    onChange={(e) =>
                      setSpecs({
                        ...specs,
                        replicas: Number.parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="font-mono text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Load balanced across target edge node cores
                  </span>
                </Field>

                <Field>
                  <FieldLabel className="text-xs">OOM Killer Action</FieldLabel>
                  <SearchableSelect
                    value={specs.oomPolicy || "kill"}
                    onChange={(val) =>
                      setSpecs({
                        ...specs,
                        oomPolicy: val as "kill" | "throttle",
                      })
                    }
                    options={OOM_OPTIONS}
                    placeholder="Select OOM action..."
                  />
                </Field>
              </div>

              {/* Host Capacity Preview */}
              {targetNode && (
                <div className="rounded border border-border bg-card p-3.5 text-xs">
                  <span className="font-semibold text-foreground">
                    Assigned Node Capacity ({targetNode.name})
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-4">
                    <div>
                      <span>Total Cores:</span>{" "}
                      <span className="font-bold text-foreground">
                        {targetNode.totalCores} cores
                      </span>
                    </div>
                    <div>
                      <span>Total RAM:</span>{" "}
                      <span className="font-bold text-foreground">
                        {targetNode.totalMemoryGb} GB
                      </span>
                    </div>
                    <div>
                      <span>Reserved CPU:</span>{" "}
                      <span className="font-bold text-primary">
                        {(
                          ((specs.cpuLimit * specs.replicas) /
                            targetNode.totalCores) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div>
                      <span>Reserved RAM:</span>{" "}
                      <span className="font-bold text-emerald-500">
                        {(
                          ((specs.memoryLimitMb * specs.replicas) /
                            (targetNode.totalMemoryGb * 1024)) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end border-t border-border pt-4">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveSpecs}
                className="gap-2 text-xs"
              >
                {saveSuccess === "specs" ? (
                  <>
                    <Check className="size-3.5 text-white" />
                    <span>Specs Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    <span>Save Compute Specs</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Panel 4: Environment Variables */}
        {activeSection === "env" && (
          <div className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Environment Variables
                </h2>
                <p className="text-xs text-muted-foreground">
                  Variables injected at container boot during gRPC
                  orchestration.
                </p>
              </div>

              {/* Mode switch */}
              <div className="flex rounded-md border border-border bg-muted/30 p-0.5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setEnvMode("kv")}
                  className={cn(
                    "rounded px-3 py-1 transition-colors",
                    envMode === "kv"
                      ? "bg-card font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Key-Value
                </button>
                <button
                  type="button"
                  onClick={() => setEnvMode("raw")}
                  className={cn(
                    "rounded px-3 py-1 transition-colors",
                    envMode === "raw"
                      ? "bg-card font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Raw .env
                </button>
              </div>
            </div>

            {envMode === "kv" ? (
              <div className="space-y-3">
                {envVars.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={item.key}
                      onChange={(e) => {
                        const next = [...envVars]
                        next[idx].key = e.target.value
                        setEnvVars(next)
                      }}
                      placeholder="KEY"
                      className="flex-1 font-mono text-xs"
                    />
                    <span className="font-mono text-muted-foreground">=</span>
                    <div className="relative flex-1">
                      <Input
                        type={
                          item.isSecret && !revealedSecrets[idx]
                            ? "password"
                            : "text"
                        }
                        value={item.value}
                        onChange={(e) => {
                          const next = [...envVars]
                          next[idx].value = e.target.value
                          setEnvVars(next)
                        }}
                        placeholder="VALUE"
                        className="pr-8 font-mono text-xs"
                      />
                      {item.isSecret && (
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedSecrets((prev) => ({
                              ...prev,
                              [idx]: !prev[idx],
                            }))
                          }
                          className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {revealedSecrets[idx] ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        setEnvVars(envVars.filter((_, i) => i !== idx))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEnvVars([
                      ...envVars,
                      { key: "", value: "", isSecret: false },
                    ])
                  }
                  className="gap-1.5 font-mono text-xs"
                >
                  <Plus className="size-3.5" />
                  <span>Add Variable</span>
                </Button>
              </div>
            ) : (
              <CodeEditor
                language="dotenv"
                value={envRawText}
                onChange={setEnvRawText}
                minHeight="min-h-[300px]"
                showLineNumbers={true}
                showCopy={true}
                title=".env"
              />
            )}

            <div className="flex items-center justify-end border-t border-border pt-4">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEnv}
                className="gap-2 text-xs"
              >
                {saveSuccess === "env" ? (
                  <>
                    <Check className="size-3.5 text-white" />
                    <span>Variables Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    <span>Save Variables</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Panel 5: Networking & Ports */}
        {activeSection === "networking" && (
          <div className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-bold text-foreground">
                Networking & Port Mappings
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure container port ingress forwarding and mesh isolation.
              </p>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-semibold text-foreground">
                Active Port Forwarding
              </span>

              <div className="space-y-2">
                {portMappings.map((pm, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded border border-border bg-muted/20 p-3 font-mono text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span>
                        Host:{" "}
                        <strong className="text-primary">{pm.host}</strong>
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span>
                        Container:{" "}
                        <strong className="text-emerald-500">
                          {pm.container}
                        </strong>
                      </span>
                      <span className="py-0.2 rounded bg-muted px-1.5 text-[10px] text-muted-foreground uppercase">
                        {pm.protocol}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDeletePort(idx)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add Port Form using shadcn Field, Input, and SearchableSelect */}
              <div className="flex flex-col gap-2.5 rounded border border-border/80 bg-muted/10 p-3 sm:flex-row sm:items-end">
                <Field className="flex-1">
                  <FieldLabel className="text-[11px]">Host Port</FieldLabel>
                  <Input
                    type="number"
                    value={newHostPort}
                    onChange={(e) => setNewHostPort(e.target.value)}
                    placeholder="8080"
                    className="font-mono text-xs"
                  />
                </Field>
                <Field className="flex-1">
                  <FieldLabel className="text-[11px]">
                    Container Port
                  </FieldLabel>
                  <Input
                    type="number"
                    value={newContainerPort}
                    onChange={(e) => setNewContainerPort(e.target.value)}
                    placeholder="8080"
                    className="font-mono text-xs"
                  />
                </Field>
                <Field className="w-24">
                  <FieldLabel className="text-[11px]">Protocol</FieldLabel>
                  <SearchableSelect
                    size="sm"
                    value={newProtocol}
                    onChange={(val) => setNewProtocol(val as "tcp" | "udp")}
                    options={PROTOCOL_OPTIONS}
                    placeholder="Proto"
                  />
                </Field>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddPort}
                  className="shrink-0 gap-1 text-xs"
                >
                  <Plus className="size-3.5" />
                  <span>Bind Port</span>
                </Button>
              </div>
            </div>

            {/* Ingress Isolation */}
            <div className="rounded border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Public Edge Ingress
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    When enabled, container ports are accessible from public
                    edge router. When disabled, only internal cluster mesh can
                    reach this container.
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Toggle public edge ingress"
                  onClick={() => setIsPublicIngress(!isPublicIngress)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                    isPublicIngress ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs transition-transform",
                      isPublicIngress ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Panel 6: Health Checks */}
        {activeSection === "health" && (
          <div className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-bold text-foreground">
                Container Health Check Probes
              </h2>
              <p className="text-xs text-muted-foreground">
                Define HTTP or TCP liveness probes executed by local edge
                daemon.
              </p>
            </div>

            <div className="flex items-center justify-between rounded border border-border p-3.5 text-xs">
              <div>
                <div className="font-semibold text-foreground">
                  Enable Periodic Health Checks
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Edge agent automatically restarts degraded containers upon
                  consecutive probe failures.
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle periodic health checks"
                onClick={() => setHealthEnabled(!healthEnabled)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  healthEnabled ? "bg-emerald-500" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs transition-transform",
                    healthEnabled ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {healthEnabled && (
              <FieldGroup className="gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel className="text-xs">HTTP Probe Path</FieldLabel>
                    <Input
                      value={healthPath}
                      onChange={(e) => setHealthPath(e.target.value)}
                      placeholder="/healthz"
                      className="font-mono text-xs"
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="text-xs">
                      Probe Target Port
                    </FieldLabel>
                    <Input
                      type="number"
                      value={healthPort}
                      onChange={(e) => setHealthPort(e.target.value)}
                      placeholder="8443"
                      className="font-mono text-xs"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel className="text-xs">
                      Interval (seconds)
                    </FieldLabel>
                    <Input
                      type="number"
                      value={healthInterval}
                      onChange={(e) => setHealthInterval(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="text-xs">
                      Timeout (seconds)
                    </FieldLabel>
                    <Input
                      type="number"
                      value={healthTimeout}
                      onChange={(e) => setHealthTimeout(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="text-xs">Failure Retries</FieldLabel>
                    <Input
                      type="number"
                      value={healthRetries}
                      onChange={(e) => setHealthRetries(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </Field>
                </div>

                {/* Probe tester button */}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testingHealth}
                      onClick={handleTestHealth}
                      className="gap-1.5 font-mono text-xs"
                    >
                      <RefreshCw
                        className={cn(
                          "size-3.5",
                          testingHealth && "animate-spin"
                        )}
                      />
                      <span>
                        {testingHealth ? "Probing..." : "Test Health Probe Now"}
                      </span>
                    </Button>
                  </div>

                  {healthTestResult && (
                    <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 font-mono text-xs text-emerald-400">
                      {healthTestResult}
                    </div>
                  )}
                </div>
              </FieldGroup>
            )}

            <div className="flex items-center justify-end border-t border-border pt-4">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveHealth}
                className="gap-2 text-xs"
              >
                {saveSuccess === "health" ? (
                  <>
                    <Check className="size-3.5 text-white" />
                    <span>Health Settings Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    <span>Save Health Settings</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Panel 7: Danger Zone */}
        {activeSection === "danger" && (
          <div className="space-y-6 rounded-lg border border-destructive/40 bg-card p-5 shadow-xs sm:p-6">
            <div className="border-b border-destructive/30 pb-4">
              <h2 className="text-base font-bold text-destructive">
                Danger Zone
              </h2>
              <p className="text-xs text-muted-foreground">
                Irreversible control plane operations. Proceed with extreme
                caution.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-bold text-foreground">
                    Force Recreate Container
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Destroys and recreates all running container instances from
                    local image cache.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    alert("Container recreation dispatched via gRPC.")
                  }
                  className="text-xs"
                >
                  Recreate Instances
                </Button>
              </div>

              <div className="flex flex-col gap-3 rounded border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-bold text-destructive">
                    Delete this Service
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Permanently unlinks service manifests, stops edge
                    containers, and deletes telemetry records.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-xs"
                >
                  Delete Service
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Domain Route Modal */}
      <Dialog
        open={addDomainDialogOpen}
        onOpenChange={(open) => {
          setAddDomainDialogOpen(open)
          if (!open) resetNewDomainForm()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <Globe className="size-4 text-primary" />
              <span>Add Domain Route</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Route a public host and path to a declared container port through
              a configured edge entrypoint.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleAddDomain()
            }}
            noValidate
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                data-invalid={Boolean(domainErrors.domain)}
                className="gap-1.5 sm:col-span-2"
              >
                <FieldLabel htmlFor="new-domain-name" className="text-[11px]">
                  Domain Name
                </FieldLabel>
                <Input
                  id="new-domain-name"
                  autoComplete="off"
                  value={newDomainInput}
                  onChange={(e) => {
                    setNewDomainInput(e.target.value)
                    clearDomainError("domain")
                  }}
                  placeholder="app.mydomain.com"
                  aria-invalid={Boolean(domainErrors.domain)}
                  aria-describedby={
                    domainErrors.domain ? "new-domain-name-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError id="new-domain-name-error" className="text-[11px]">
                  {domainErrors.domain}
                </FieldError>
              </Field>
              <Field
                data-invalid={Boolean(domainErrors.path)}
                className="gap-1.5"
              >
                <FieldLabel htmlFor="new-domain-path" className="text-[11px]">
                  Path
                </FieldLabel>
                <Input
                  id="new-domain-path"
                  autoComplete="off"
                  value={newDomainPath}
                  onChange={(e) => {
                    setNewDomainPath(e.target.value)
                    clearDomainError("path")
                  }}
                  placeholder="/"
                  aria-invalid={Boolean(domainErrors.path)}
                  aria-describedby={
                    domainErrors.path ? "new-domain-path-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError id="new-domain-path-error" className="text-[11px]">
                  {domainErrors.path}
                </FieldError>
              </Field>
              <Field
                data-invalid={Boolean(domainErrors.internalPath)}
                className="gap-1.5"
              >
                <FieldLabel
                  htmlFor="new-domain-internal-path"
                  className="text-[11px]"
                >
                  Internal Path
                </FieldLabel>
                <Input
                  id="new-domain-internal-path"
                  autoComplete="off"
                  value={newDomainInternalPath}
                  onChange={(e) => {
                    setNewDomainInternalPath(e.target.value)
                    clearDomainError("internalPath")
                  }}
                  placeholder="/"
                  aria-invalid={Boolean(domainErrors.internalPath)}
                  aria-describedby={
                    domainErrors.internalPath
                      ? "new-domain-internal-path-error"
                      : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError
                  id="new-domain-internal-path-error"
                  className="text-[11px]"
                >
                  {domainErrors.internalPath}
                </FieldError>
              </Field>
              <Field
                data-invalid={Boolean(domainErrors.container)}
                className="gap-1.5"
              >
                {serviceContainers.length > 1 ? (
                  <>
                    <FieldLabel
                      htmlFor="new-domain-container"
                      className="text-[11px]"
                    >
                      Target Container
                    </FieldLabel>
                    <SearchableSelect
                      id="new-domain-container"
                      value={newDomainContainer}
                      onChange={(value) => {
                        setNewDomainContainer(value)
                        clearDomainError("container")
                        const nextContainer = serviceContainers.find(
                          (container) => container.name === value
                        )
                        const firstPort = nextContainer?.ports[0]
                        if (firstPort) {
                          setNewDomainPort(String(firstPort.port))
                        }
                      }}
                      options={domainContainerOptions}
                      placeholder="Select container..."
                      searchPlaceholder="Search containers..."
                    />
                  </>
                ) : (
                  <>
                    <FieldLabel className="text-[11px]">
                      Target Container
                    </FieldLabel>
                    <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-muted/20 px-2.5 font-mono text-xs">
                      <span className="truncate">
                        {mainContainer?.name ?? "unset"}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">
                        main
                      </span>
                    </div>
                  </>
                )}
                <FieldError
                  id="new-domain-container-error"
                  className="text-[11px]"
                >
                  {domainErrors.container}
                </FieldError>
              </Field>
              <Field
                data-invalid={Boolean(domainErrors.port)}
                className="gap-1.5"
              >
                <FieldLabel htmlFor="new-domain-port" className="text-[11px]">
                  Target Port
                </FieldLabel>
                <SearchableSelect
                  id="new-domain-port"
                  value={newDomainPort}
                  onChange={(value) => {
                    setNewDomainPort(value)
                    clearDomainError("port")
                  }}
                  options={domainPortOptions}
                  placeholder={
                    selectedDomainPorts.length > 0
                      ? "Select port..."
                      : "No exposed ports"
                  }
                  searchPlaceholder="Search ports..."
                  disabled={selectedDomainPorts.length === 0}
                />
                <FieldError id="new-domain-port-error" className="text-[11px]">
                  {domainErrors.port}
                </FieldError>
              </Field>
              <Field
                data-invalid={Boolean(domainErrors.entryPoint)}
                className="gap-1.5 sm:col-span-2"
              >
                <FieldLabel
                  htmlFor="new-domain-entry-point"
                  className="text-[11px]"
                >
                  Entry Point
                </FieldLabel>
                <SearchableSelect
                  id="new-domain-entry-point"
                  value={newDomainEntryPoint}
                  onChange={(value) => {
                    setNewDomainEntryPoint(value)
                    clearDomainError("entryPoint")
                  }}
                  options={EDGE_ENTRYPOINT_OPTIONS}
                  placeholder="Select entrypoint..."
                  searchPlaceholder="Search entrypoints..."
                />
                <FieldError
                  id="new-domain-entry-point-error"
                  className="text-[11px]"
                >
                  {domainErrors.entryPoint}
                </FieldError>
              </Field>
            </div>

            <div className="flex items-center justify-between gap-3 rounded border border-border/80 bg-muted/20 p-3">
              <div className="flex items-center gap-2.5">
                {newDomainHttps ? (
                  <ShieldCheck className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <ShieldOff className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <div className="text-xs font-medium text-foreground">
                    {selectedEdgeEntryPoint
                      ? newDomainHttps
                        ? "TLS terminated at edge"
                        : "Unencrypted edge route"
                      : "No entrypoint selected"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {selectedEdgeEntryPoint
                      ? `HTTPS mode follows ${selectedEdgeEntryPoint.name}`
                      : "TLS mode is derived from the selected entrypoint"}
                  </div>
                </div>
              </div>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
                  !selectedEdgeEntryPoint
                    ? "bg-muted text-muted-foreground"
                    : newDomainHttps
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {selectedEdgeEntryPoint
                  ? newDomainHttps
                    ? "HTTPS"
                    : "HTTP"
                  : "UNSET"}
              </span>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddDomainDialogOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="gap-1.5 text-xs">
                <Plus className="size-3.5" />
                <span>Add Domain</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Service Confirmation Modal */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              <span>Confirm Service Deletion</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will permanently remove the service from the cluster.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded border border-destructive/30 bg-destructive/5 px-3 py-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Deleting this service stops all running containers, removes its
                routes and domains, and deletes telemetry history. This action
                cannot be undone.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="block font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                Service name
              </span>
              <div className="rounded border border-border/80 bg-muted/20 px-3 py-2.5">
                <strong className="block font-mono text-xs leading-relaxed font-semibold break-all text-foreground">
                  {service.name}
                </strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="delete-service-confirmation"
                className="text-[11px] font-medium text-foreground"
              >
                Type the service name to confirm
              </label>
              <Input
                id="delete-service-confirmation"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={service.name}
                aria-label="Service name confirmation"
                autoComplete="off"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteConfirmText("")
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteConfirmText !== service.name}
              onClick={handleConfirmDelete}
              className="text-xs"
            >
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
