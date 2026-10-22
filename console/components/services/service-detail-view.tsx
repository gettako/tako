"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Boxes,
  ChevronDown,
  Clock,
  FileCode2,
  Layers,
  LayoutDashboard,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  Rocket,
  ScrollText,
  Settings,
  Terminal,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CodeEditor } from "@/components/ui/code-editor"
import { EmptyState } from "@/components/ui/empty-state"
import { Flag } from "@/components/ui/flag"
import { ServiceDeploymentsTab } from "@/components/services/service-deployments-tab"
import { ServiceLogsTab } from "@/components/services/service-logs-tab"
import { ServiceOverviewTab } from "@/components/services/service-overview-tab"
import { ServiceSettingsView } from "@/components/services/service-settings-view"
import { ServiceTerminalTab } from "@/components/services/service-terminal-tab"
import { usePlatformData } from "@/context/platform-data-context"
import { activeStatusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"

export function ServiceDetailView({
  projectId,
  serviceId,
}: {
  projectId: string
  serviceId: string
}) {
  const {
    services,
    projects,
    nodes,
    currentUser,
    triggerDeploy,
    cancelDeploy,
    activeDeployingId,
    updateService,
    addAuditLog,
  } = usePlatformData()

  const service = services.find((s) => s.id === serviceId)
  const project = projects.find((p) => p.id === projectId)
  const targetNode = nodes.find((n) => n.id === service?.targetNodeId)

  const [activeTab, setActiveTab] = React.useState<
    "overview" | "deployments" | "terminal" | "logs" | "config" | "settings"
  >("overview")

  // Code editor state
  const [configContent, setConfigContent] = React.useState(
    () =>
      (service?.type === "dockerfile"
        ? service.dockerfileContent
        : service?.composeContent) || ""
  )
  const [configSaved, setConfigSaved] = React.useState(false)
  const [isRestarting, setIsRestarting] = React.useState(false)
  const [restartSuccess, setRestartSuccess] = React.useState(false)
  const [isDeployMenuOpen, setIsDeployMenuOpen] = React.useState(false)
  const deployMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        deployMenuRef.current &&
        !deployMenuRef.current.contains(event.target as Node)
      ) {
        setIsDeployMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDeployMenuOpen(false)
      }
    }

    if (isDeployMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isDeployMenuOpen])

  // Derive active tab to prevent invalid config tab state on Dockerfile services
  const currentTab =
    service?.type === "dockerfile" && activeTab === "config"
      ? "overview"
      : activeTab

  if (!service) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Project Services</span>
          </Link>
        </div>
        <EmptyState
          icon={Layers}
          title="Service Not Found"
          description="The requested service could not be located or may have been removed."
          actionLabel="Return to Projects"
          onAction={() => window.location.assign(`/projects/${projectId}`)}
        />
      </div>
    )
  }

  const isDeploying =
    activeDeployingId === service.id || service.status === "deploying"
  const isRunning = service.status === "running"

  const actorName = currentUser.email || currentUser.name || "admin@gettako.dev"

  const handleRestartService = async () => {
    setIsRestarting(true)
    try {
      await updateService(service.id, { action: "restart" })
      setRestartSuccess(true)
      addAuditLog({
        action: "Container Restarted",
        category: "node",
        actor: { name: actorName, type: "user" },
        target: `${service.name} (${service.id})`,
        details: `Graceful container restart on node ${service.targetNodeId}`,
        status: "success",
      })
    } finally {
      setIsRestarting(false)
      setTimeout(() => setRestartSuccess(false), 3000)
    }
  }

  const handleToggleState = async () => {
    const nextAction = isRunning ? "stop" : "start"
    await updateService(service.id, { action: nextAction })
    addAuditLog({
      action: isRunning ? "Service Stopped" : "Service Started",
      category: "node",
      actor: { name: actorName, type: "user" },
      target: `${service.name} (${service.id})`,
      details: `Service container status updated via action ${nextAction}`,
      status: "success",
    })
  }

  const specs = service.resourceSpecs || {
    cpuReservation: 0.25,
    cpuLimit: 1.0,
    memoryReservationMb: 256,
    memoryLimitMb: service.metrics.memoryLimitMb || 1024,
    replicas: 1,
  }

  const handleSaveConfig = () => {
    if (service.type === "dockerfile") {
      updateService(service.id, { dockerfileContent: configContent })
    } else {
      updateService(service.id, { composeContent: configContent })
    }
    setConfigSaved(true)
    setTimeout(() => setConfigSaved(false), 2000)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Operational Status & Global Controls Header */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
            {service.type === "dockerfile" ? (
              <FileCode2 className="size-6 text-primary" />
            ) : (
              <Boxes className="size-6 text-emerald-500" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-bold text-foreground">
                {service.name}
              </h1>
              <span className="rounded border border-border/70 bg-muted/50 px-2 py-0.5 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                {service.type === "dockerfile"
                  ? "Dockerfile"
                  : "Docker Compose"}
              </span>
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 font-mono text-xs">
                {isDeploying ? (
                  <Loader2 className="size-3 animate-spin text-primary" />
                ) : (
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      activeStatusDotClass(isRunning)
                    )}
                  />
                )}
                <span className="font-medium text-foreground capitalize">
                  {isDeploying ? "Deploying via gRPC" : service.status}
                </span>
              </div>
              <span className="rounded border border-border/80 bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {specs.replicas} {specs.replicas > 1 ? "replicas" : "replica"}{" "}
                active
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
              {targetNode && (
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Flag
                    src={targetNode.location.flag}
                    alt={targetNode.name}
                    width={16}
                    height={11}
                    className="h-3"
                  />
                  <span>{targetNode.name}</span>
                </span>
              )}
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-500">
                <Radio className="size-3" />
                <span>gRPC: {targetNode?.grpcLatencyMs ?? 4}ms latency</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                <span>Uptime: {targetNode?.uptime || "14d 06h"}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Global Operational Action Buttons (Always Present, Terminal Button Removed) */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={isRestarting || !isRunning}
            onClick={handleRestartService}
            className="gap-1.5 text-xs"
          >
            <RefreshCw
              className={cn("size-3.5", isRestarting && "animate-spin")}
            />
            <span>{restartSuccess ? "Restarted" : "Restart"}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleToggleState}
            className={cn(
              "gap-1.5 text-xs",
              isRunning
                ? "text-destructive hover:bg-destructive/10"
                : "text-emerald-500 hover:bg-emerald-500/10"
            )}
          >
            <span>{isRunning ? "Stop Service" : "Start Service"}</span>
          </Button>

          {isDeploying ? (
            <Button
              type="button"
              variant="destructive"
              size="md"
              onClick={() => cancelDeploy(service.id)}
              className="gap-1.5 text-xs shadow-xs"
            >
              <Ban className="size-3.5" />
              <span>Cancel Deployment</span>
            </Button>
          ) : (
            <div className="relative inline-flex" ref={deployMenuRef}>
              <Button
                type="button"
                size="md"
                onClick={() => triggerDeploy(service.id)}
                className="gap-1.5 rounded-r-none text-xs"
              >
                <Play className="size-3 fill-current" />
                <span>Deploy Now</span>
              </Button>
              <Button
                type="button"
                size="md"
                onClick={() => setIsDeployMenuOpen((prev) => !prev)}
                className="rounded-l-none border-l border-primary-foreground/20 px-2 text-xs"
                aria-label="Deployment options"
                aria-expanded={isDeployMenuOpen}
              >
                <ChevronDown className="size-3.5" />
              </Button>

              {isDeployMenuOpen && (
                <div className="absolute top-full right-0 z-50 mt-1 w-56 animate-in rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md fade-in-50 zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeployMenuOpen(false)
                      triggerDeploy(service.id, { clearCache: true })
                    }}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                  >
                    <Zap className="size-3.5 text-primary" />
                    <div className="flex flex-col">
                      <span className="font-medium">Rebuild (--no-cache)</span>
                      <span className="text-[10px] text-muted-foreground">
                        Purge layers and re-download
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDeployMenuOpen(false)
                      triggerDeploy(service.id, { simulateError: true })
                    }}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-rose-500 transition-colors hover:bg-rose-500/10"
                  >
                    <AlertTriangle className="size-3.5" />
                    <div className="flex flex-col">
                      <span className="font-medium">Simulate Build Error</span>
                      <span className="text-[10px] text-muted-foreground">
                        Test error detection & jump
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation Bar */}
      <div className="flex overflow-x-auto border-b border-border text-xs">
        {/* Tab 1: Overview */}
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium whitespace-nowrap transition-colors",
            currentTab === "overview"
              ? "border-primary font-semibold text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutDashboard className="size-3.5" />
          <span>Overview</span>
        </button>

        {/* Tab 2: Deployments */}
        <button
          type="button"
          onClick={() => setActiveTab("deployments")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium whitespace-nowrap transition-colors",
            currentTab === "deployments"
              ? "border-primary font-semibold text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Rocket className="size-3.5" />
          <span>Deployments</span>
          {isDeploying && (
            <span className="size-2 animate-pulse rounded-full bg-primary" />
          )}
        </button>

        {/* Tab 3: Terminal */}
        <button
          type="button"
          onClick={() => setActiveTab("terminal")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium whitespace-nowrap transition-colors",
            currentTab === "terminal"
              ? "border-primary font-semibold text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Terminal className="size-3.5" />
          <span>Terminal</span>
          <span className="size-1.5 rounded-full bg-emerald-500" />
        </button>

        {/* Tab 4: Runtime Logs */}
        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium whitespace-nowrap transition-colors",
            currentTab === "logs"
              ? "border-primary font-semibold text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ScrollText className="size-3.5" />
          <span>Logs</span>
          {service.status === "running" && (
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
          )}
        </button>

        {/* Tab 5: Compose Manifest (Only for Docker Compose services; Dockerfile tab removed) */}
        {service.type === "docker-compose" && (
          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium whitespace-nowrap transition-colors",
              currentTab === "config"
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Boxes className="size-3.5" />
            <span>Docker Compose</span>
          </button>
        )}

        {/* Tab 6: Settings */}
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium whitespace-nowrap transition-colors",
            currentTab === "settings"
              ? "border-primary font-semibold text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings className="size-3.5" />
          <span>Service Settings</span>
        </button>
      </div>

      {/* Tab Content Rendering */}

      {/* View 1: Overview */}
      {currentTab === "overview" && (
        <ServiceOverviewTab
          service={service}
          project={project}
          targetNode={targetNode}
          onNavigateTab={setActiveTab}
        />
      )}

      {/* View 2: Deployments */}
      {currentTab === "deployments" && (
        <ServiceDeploymentsTab service={service} />
      )}

      {/* View 3: Container Terminal */}
      {currentTab === "terminal" && <ServiceTerminalTab service={service} />}

      {/* View 4: Runtime Logs */}
      {currentTab === "logs" && <ServiceLogsTab service={service} />}

      {/* View 5: Docker Compose Manifest Editor (Only for compose services) */}
      {service.type === "docker-compose" && currentTab === "config" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              <span>Target: </span>
              <code className="font-mono text-foreground">
                docker-compose.yml
              </code>{" "}
              (streamed via gRPC to remote agent)
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {configContent.split("\n").length} lines
            </span>
          </div>

          <CodeEditor
            language="yaml"
            value={configContent}
            onChange={setConfigContent}
            minHeight="min-h-[420px]"
            maxHeight="max-h-[600px]"
            showLineNumbers={true}
            showCopy={true}
            showSave={true}
            onSave={handleSaveConfig}
            isSaved={configSaved}
            title="docker-compose.yml"
            statusInfo="Live syntax highlighted"
          />
        </div>
      )}

      {/* View 6: Settings with Vertical Sub-Menu */}
      {currentTab === "settings" && (
        <ServiceSettingsView service={service} nodes={nodes} />
      )}
    </div>
  )
}
