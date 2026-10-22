"use client"

import * as React from "react"
import {
  Activity,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  GitBranch,
  Globe,
  RotateCw,
  Server,
  ShieldCheck,
  ShieldOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { getServiceContainers, resolveDomainContainer } from "@/lib/container"
import {
  domainEntryPoint,
  domainInternalPath,
  domainUrl,
  normalizePath,
} from "@/lib/domain"
import { ClusterNode, Project, ProjectService } from "@/types/platform"
import { copyToClipboard } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

interface ServiceOverviewTabProps {
  service: ProjectService
  project?: Project
  targetNode?: ClusterNode
  onNavigateTab: (
    tab:
      | "overview"
      | "deployments"
      | "terminal"
      | "logs"
      | "config"
      | "settings"
  ) => void
}

export function ServiceOverviewTab({
  service,
  targetNode,
  onNavigateTab,
}: ServiceOverviewTabProps) {
  const [copiedDomain, setCopiedDomain] = React.useState<string | null>(null)

  const handleCopy = async (text: string, id: string) => {
    if (await copyToClipboard(text)) {
      setCopiedDomain(id)
      setTimeout(() => setCopiedDomain(null), 2000)
    }
  }

  const serviceContainers = getServiceContainers(service)
  const mainContainer =
    serviceContainers.find((container) => container.isMain) ??
    serviceContainers[0]
  const mainContainerPort = mainContainer?.ports[0]

  const domains = service.domains || [
    {
      id: "default-dom",
      domain: `${service.slug}.edge.gettako.dev`,
      path: "/",
      internalPath: "/",
      entryPoint: "websecure",
      https: true,
      sslStatus: "active" as const,
      targetContainer: mainContainer?.name,
      targetPort: mainContainerPort?.port ?? 443,
      targetProtocol: mainContainerPort?.protocol ?? "tcp",
      isPrimary: true,
    },
  ]

  const specs = service.resourceSpecs || {
    cpuReservation: 0.25,
    cpuLimit: 1.0,
    memoryReservationMb: 256,
    memoryLimitMb: service.metrics.memoryLimitMb || 1024,
    replicas: 1,
  }

  const memoryPercent = Math.min(
    100,
    Math.round((service.metrics.memoryMb / specs.memoryLimitMb) * 100)
  )

  return (
    <div className="space-y-6">
      {/* 4 Key Telemetry Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CPU */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>CPU Allocation</span>
            <Cpu className="size-4 text-primary" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {service.metrics.cpuPercent}%
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              of {specs.cpuLimit} vCPU limit
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-500",
                service.metrics.cpuPercent > 80
                  ? "bg-destructive"
                  : "bg-primary"
              )}
              style={{ width: `${Math.min(100, service.metrics.cpuPercent)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Reserved: {specs.cpuReservation} vCPU</span>
            <span>Limit: {specs.cpuLimit} vCPU</span>
          </div>
        </div>

        {/* Memory */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>Memory Usage</span>
            <Server className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {service.metrics.memoryMb} MB
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              ({memoryPercent}%)
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-500",
                memoryPercent > 85 ? "bg-destructive" : "bg-emerald-500"
              )}
              style={{ width: `${memoryPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Reserved: {specs.memoryReservationMb} MB</span>
            <span>Max: {specs.memoryLimitMb} MB</span>
          </div>
        </div>

        {/* Network Ingress */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>Network Ingress</span>
            <Activity className="size-4 text-primary" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {service.metrics.networkRxMb} MB
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              cumulative RX
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" />
            <span>Active ingress stream via edge proxy</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Proto: TCP / HTTP3</span>
            <span>Zero-drop buffer</span>
          </div>
        </div>

        {/* Network Egress */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>Network Egress</span>
            <Activity className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {service.metrics.networkTxMb} MB
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              cumulative TX
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>High-throughput edge egress</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Packets: Healthy</span>
            <span>MTU: 1500 (Clean)</span>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Endpoints & Deployment Snapshot */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Endpoints & Domains */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Routing & Ingress Endpoints
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("settings")}
              className="text-xs font-medium text-primary hover:underline"
            >
              Configure in Settings
            </button>
          </div>

          <div className="mt-4 space-y-3">
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
                  className="flex flex-col gap-2 rounded border border-border/80 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-xs font-semibold text-foreground">
                        {url}
                      </span>
                      {dom.isPrimary && (
                        <span className="py-0.2 rounded bg-primary/10 px-1.5 font-mono text-[10px] font-medium text-primary uppercase">
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
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
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
                        <span>{secure ? "TLS active" : "TLS disabled"}</span>
                      </span>
                      <span>Path: {path}</span>
                      <span>→ {internalPath}</span>
                      <span>Entry: {entryPoint}</span>
                      <span>Container: {targetContainer?.name ?? "unset"}</span>
                      <span>
                        Port: {dom.targetPort}/{dom.targetProtocol ?? "tcp"}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleCopy(url, dom.id)}
                      title="Copy full URL"
                    >
                      {copiedDomain === dom.id ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Open endpoint in new tab"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
              )
            })}

            {/* Container Ports Mapping */}
            <div className="rounded border border-border/80 bg-muted/10 p-3">
              <div className="font-mono text-xs font-medium text-foreground">
                Container Port Mappings
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {service.portMappings.map((pm, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 rounded border border-border bg-card px-2.5 py-1 font-mono text-xs text-foreground"
                  >
                    <span className="text-muted-foreground">Host</span>
                    <span className="font-bold text-primary">{pm.host}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-muted-foreground">Container</span>
                    <span className="font-bold text-emerald-500">
                      {pm.container}
                    </span>
                    <span className="py-0.2 rounded bg-muted px-1 text-[10px] text-muted-foreground uppercase">
                      {pm.protocol}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Active Deployment Snapshot */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <RotateCw className="size-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-foreground">
                Current Active Deployment
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("deployments")}
              className="text-xs font-medium text-primary hover:underline"
            >
              View Pipeline & Logs
            </button>
          </div>

          <div className="mt-4 space-y-3.5">
            <div className="rounded border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="font-mono text-xs font-bold text-foreground">
                    commit {service.lastDeployment.commitHash}
                  </span>
                  <span className="py-0.2 rounded bg-emerald-500/10 px-1.5 font-mono text-[10px] font-medium text-emerald-500 uppercase">
                    Live
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {service.lastDeployment.startedAt}
                </span>
              </div>

              <p className="mt-2 font-mono text-xs text-foreground">
                {service.lastDeployment.message}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-2.5 font-mono text-[11px] text-muted-foreground">
                <span>Trigger: {service.lastDeployment.triggerBy}</span>
                <span>•</span>
                <span>Build Duration: {service.lastDeployment.duration}</span>
                <span>•</span>
                <span className="text-emerald-500">Zero-downtime switch</span>
              </div>
            </div>

            {/* Quick Runtime Spec Summary */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded border border-border/70 bg-card p-2.5">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Git Repository
                </span>
                <div className="mt-1 flex items-center gap-1.5 truncate font-mono font-medium text-foreground">
                  <GitBranch className="size-3 shrink-0 text-primary" />
                  <span className="truncate">{service.gitBranch}</span>
                </div>
              </div>

              <div className="rounded border border-border/70 bg-card p-2.5">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Restart Policy
                </span>
                <div className="mt-1 font-mono font-medium text-foreground">
                  {service.restartPolicy}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Recent Container Activity & Lifecycle
            </h2>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Live event stream
          </span>
        </div>

        <div className="mt-3 divide-y divide-border/60 font-mono text-xs">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-foreground">
                Container Health Check Passed
              </span>
              <span className="text-muted-foreground">
                (HTTP GET /healthz returned 200 OK)
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              2 mins ago
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-primary" />
              <span className="font-medium text-foreground">
                gRPC Bi-directional Heartbeat Ping
              </span>
              <span className="text-muted-foreground">
                (latency: {targetNode?.grpcLatencyMs ?? 4}ms to{" "}
                {targetNode?.name})
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              5 mins ago
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-foreground">
                Deployment Completed Successfully
              </span>
              <span className="text-muted-foreground">
                (commit {service.lastDeployment.commitHash})
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {service.lastDeployment.startedAt}
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-muted-foreground" />
              <span className="font-medium text-foreground">
                Container Configuration Synchronized
              </span>
              <span className="text-muted-foreground">
                ({service.envVars.length} environment variables loaded)
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              1 hour ago
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
