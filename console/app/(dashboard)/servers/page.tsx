"use client"

import * as React from "react"
import {
  HardDrives,
  Plus,
  MagnifyingGlass,
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  Cube,
  Cpu,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ServerCard } from "@/components/servers/server-card"
import { AddServerDialog } from "@/components/servers/add-server-dialog"
import { LoadingSkeleton, EmptyState, ErrorCard } from "@/components/states"
import { api, ApiError, type Server } from "@/lib/api"

export default function ServersPage() {
  const [servers, setServers] = React.useState<Server[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const fetchServers = React.useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true)
      setError(null)
    }
    try {
      const data = await api.servers.list()
      setServers(data)
    } catch (err) {
      if (!isBackground) {
        if (err instanceof Error) {
          setError(err)
        } else {
          setError(new Error("Failed to load servers."))
        }
      }
    } finally {
      if (!isBackground) {
        setIsLoading(false)
      }
    }
  }, [])

  React.useEffect(() => {
    fetchServers(false)
  }, [fetchServers])

  // Periodic auto-refresh every 10 seconds matching agent telemetry heartbeats
  React.useEffect(() => {
    const timer = setInterval(() => {
      fetchServers(true)
    }, 10000)
    return () => clearInterval(timer)
  }, [fetchServers])

  // Filtered servers
  const filteredServers = React.useMemo(() => {
    if (!searchQuery.trim()) return servers
    const q = searchQuery.toLowerCase().trim()
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.host.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
    )
  }, [servers, searchQuery])

  // Cluster telemetry calculations
  const stats = React.useMemo(() => {
    const total = servers.length
    const online = servers.filter((s) => s.status === "online").length
    const totalServices = servers.reduce(
      (acc, s) => acc + (s.active_services_count || 0),
      0
    )
    const avgCpu =
      total > 0
        ? (servers.reduce((acc, s) => acc + s.cpu_percent, 0) / total).toFixed(
            1
          )
        : "0"

    return { total, online, totalServices, avgCpu }
  }, [servers])

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Servers
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor host nodes, agent telemetry, and cluster capacity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchServers()}
            disabled={isLoading}
            className="gap-2"
            aria-label="Refresh servers list"
          >
            <ArrowsClockwiseIcon className="size-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="size-4" />
            <span>Add Server</span>
          </Button>
        </div>
      </div>

      {/* Cluster Overview Stats */}
      {!isLoading && !error && servers.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total Nodes</span>
              <span className="font-heading text-xl font-bold text-foreground">
                {stats.total}
              </span>
            </div>
            <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/50 text-foreground">
              <HardDrives className="size-4" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                Online Nodes
              </span>
              <span className="font-heading text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.online} / {stats.total}
              </span>
            </div>
            <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/50 text-emerald-500">
              <CheckCircleIcon className="size-4" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                Active Services
              </span>
              <span className="font-heading text-xl font-bold text-foreground">
                {stats.totalServices}
              </span>
            </div>
            <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/50 text-foreground">
              <Cube className="size-4" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                Avg Cluster CPU
              </span>
              <span className="font-heading text-xl font-bold text-foreground">
                {stats.avgCpu}%
              </span>
            </div>
            <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/50 text-foreground">
              <Cpu className="size-4" />
            </div>
          </div>
        </div>
      )}

      {/* Search Filter Bar */}
      {!isLoading && !error && servers.length > 0 && (
        <div className="relative max-w-md">
          <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by server nickname or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
      )}

      {/* Main Content Area: Loading, Error, Empty, or Data */}
      {isLoading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : error ? (
        <ErrorCard
          error={error}
          title="Failed to load servers"
          onRetry={fetchServers}
        />
      ) : servers.length === 0 ? (
        <EmptyState
          icon={HardDrives}
          title="No servers connected"
          description="Connect your first remote host node or worker instance to start deploying web services."
          action={{
            label: "Add Server",
            onClick: () => setIsAddDialogOpen(true),
          }}
        />
      ) : filteredServers.length === 0 ? (
        <EmptyState
          icon={MagnifyingGlass}
          title="No matching servers found"
          description={`No host nodes match the filter query "${searchQuery}".`}
          action={{
            label: "Clear Filter",
            onClick: () => setSearchQuery(""),
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredServers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      )}

      {/* Add Server Enrollment Wizard Modal */}
      <AddServerDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onServerAdded={() => {
          fetchServers()
        }}
      />
    </div>
  )
}
