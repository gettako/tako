"use client"

import * as React from "react"
import {
  Check,
  CheckCircle2,
  Download,
  Eye,
  ScrollText,
  Search,
  Server,
  Shield,
  User,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CodeHighlighter } from "@/components/ui/code-highlighter"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select"
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"
import { AuditLogEntry } from "@/types/platform"

export function AuditLogsView() {
  const { auditLogs, setDataMode } = usePlatformData()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState("all")
  const [selectedActorType, setSelectedActorType] = React.useState("all")
  const [selectedStatus, setSelectedStatus] = React.useState("all")
  const [selectedEntry, setSelectedEntry] =
    React.useState<AuditLogEntry | null>(null)
  const [isExporting, setIsExporting] = React.useState(false)
  const [exportNotice, setExportNotice] = React.useState(false)

  const categoryOptions: SelectOption[] = [
    { value: "all", label: "All Categories" },
    {
      value: "deployment",
      label: "Deployment Events",
      description: "Container builds and orchestration",
    },
    {
      value: "node",
      label: "Node & Agent Events",
      description: "Edge agent heartbeats and registrations",
    },
    {
      value: "project",
      label: "Project Workloads",
      description: "Project creation and updates",
    },
    {
      value: "security",
      label: "Security & Keys",
      description: "Tokens and mutual TLS certificates",
    },
    {
      value: "config",
      label: "Cluster Configuration",
      description: "Platform settings and adjustments",
    },
  ]

  const actorTypeOptions: SelectOption[] = [
    { value: "all", label: "All Actor Types" },
    {
      value: "user",
      label: "Human Operators",
      description: "Console logins and actions",
    },
    {
      value: "agent",
      label: "Edge Agent Daemons",
      description: "Automated tako-agent communications",
    },
    {
      value: "system",
      label: "System & CI Pipelines",
      description: "Automated cron and security workers",
    },
  ]

  const statusOptions: SelectOption[] = [
    { value: "all", label: "All Statuses" },
    {
      value: "success",
      label: "Success",
      description: "Completed successfully",
    },
    {
      value: "failure",
      label: "Failed",
      description: "Rejected or encountered errors",
    },
  ]

  const filteredLogs = auditLogs.filter((entry) => {
    if (selectedCategory !== "all" && entry.category !== selectedCategory) {
      return false
    }
    if (selectedActorType !== "all" && entry.actor.type !== selectedActorType) {
      return false
    }
    if (selectedStatus !== "all" && entry.status !== selectedStatus) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        entry.action.toLowerCase().includes(q) ||
        entry.target.toLowerCase().includes(q) ||
        entry.actor.name.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleExportCsv = () => {
    setIsExporting(true)
    const header =
      "id,timestamp,category,action,actor_name,actor_type,target,status,details\n"
    const rows = filteredLogs
      .map(
        (e) =>
          `"${e.id}","${e.timestamp}","${e.category}","${e.action}","${e.actor.name}","${e.actor.type}","${e.target}","${e.status}","${e.details.replace(/"/g, '""')}"`
      )
      .join("\n")

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute(
      "download",
      `tako-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setIsExporting(false)
    setExportNotice(true)
    setTimeout(() => setExportNotice(false), 3000)
  }

  if (auditLogs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Audit Logs & Security Trail
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Immutable log of deployment actions, edge agent connections, and
            security events.
          </p>
        </div>

        <EmptyState
          icon={ScrollText}
          title="No Audit Logs Recorded"
          description="There are currently no recorded audit trail entries. Perform operations across the cluster or restore sample data."
          actionLabel="Restore Sample Data"
          onAction={() => setDataMode(true)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Audit Logs & Security Trail
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Immutable log of gRPC deployment dispatches, edge node
            registrations, and security mutations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="md"
            variant="outline"
            onClick={handleExportCsv}
            disabled={isExporting || filteredLogs.length === 0}
            className="gap-1.5 text-xs"
          >
            {exportNotice ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Download className="size-3.5" />
            )}
            <span>{exportNotice ? "CSV Exported" : "Export CSV"}</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search action, target, actor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        {/* Category */}
        <SearchableSelect
          value={selectedCategory}
          onChange={(val) => setSelectedCategory(val)}
          options={categoryOptions}
          placeholder="Filter category..."
          searchPlaceholder="Search categories..."
        />

        {/* Actor Type */}
        <SearchableSelect
          value={selectedActorType}
          onChange={(val) => setSelectedActorType(val)}
          options={actorTypeOptions}
          placeholder="Filter actor..."
          searchPlaceholder="Search actor types..."
        />

        {/* Status */}
        <SearchableSelect
          value={selectedStatus}
          onChange={(val) => setSelectedStatus(val)}
          options={statusOptions}
          placeholder="Filter status..."
          searchPlaceholder="Search statuses..."
        />
      </div>

      {/* Filter result count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">
          Showing {filteredLogs.length} of {auditLogs.length} audit entries
        </span>
        {(selectedCategory !== "all" ||
          selectedActorType !== "all" ||
          selectedStatus !== "all" ||
          searchQuery.trim()) && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => {
              setSelectedCategory("all")
              setSelectedActorType("all")
              setSelectedStatus("all")
              setSearchQuery("")
            }}
            className="text-xs text-primary hover:underline"
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* Audit Log Table */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No Matching Audit Records"
          description="No audit records matched your current query and filter criteria."
          actionLabel="Clear Filters"
          onAction={() => {
            setSelectedCategory("all")
            setSelectedActorType("all")
            setSelectedStatus("all")
            setSearchQuery("")
          }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/30 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Event & Status</th>
                <th className="px-4 py-3">Target Resource</th>
                <th className="px-4 py-3">Actor</th>
                <th className="hidden px-4 py-3 md:table-cell">
                  Summary Details
                </th>
                <th className="px-4 py-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.map((entry) => {
                const isSuccess = entry.status === "success"
                return (
                  <tr
                    key={entry.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    {/* Event & Status */}
                    <td
                      className="px-4 py-3"
                      aria-label={`Event: ${entry.action}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full",
                            isSuccess
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-destructive/10 text-destructive"
                          )}
                          title={`Status: ${entry.status}`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            <XCircle className="size-3.5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedEntry(entry)}
                              className="text-left font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                            >
                              {entry.action}
                            </button>
                            <span
                              className={cn(
                                "shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider uppercase",
                                entry.category === "deployment"
                                  ? "border border-primary/20 bg-primary/10 text-primary"
                                  : entry.category === "node"
                                    ? "border border-purple-500/20 bg-purple-500/10 text-purple-400"
                                    : entry.category === "project"
                                      ? "border border-blue-500/20 bg-blue-500/10 text-blue-400"
                                      : entry.category === "security"
                                        ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                        : "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                              )}
                            >
                              {entry.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Target Resource */}
                    <td className="px-4 py-3 font-mono text-xs">
                      <span
                        className="block max-w-[200px] truncate text-foreground"
                        title={entry.target}
                      >
                        {entry.target}
                      </span>
                    </td>

                    {/* Actor */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        {entry.actor.type === "user" ? (
                          <User className="size-3 shrink-0 text-primary" />
                        ) : entry.actor.type === "agent" ? (
                          <Server className="size-3 shrink-0 text-purple-400" />
                        ) : (
                          <Shield className="size-3 shrink-0 text-emerald-400" />
                        )}
                        <span
                          className="max-w-[160px] truncate text-foreground"
                          title={entry.actor.name}
                        >
                          {entry.actor.name}
                        </span>
                      </div>
                    </td>

                    {/* Summary Details */}
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      <span
                        className="block max-w-sm truncate text-xs"
                        title={entry.details}
                      >
                        {entry.details}
                      </span>
                    </td>

                    {/* Timestamp & Action */}
                    <td
                      className="px-4 py-3 text-right"
                      aria-label={`Timestamp: ${entry.timestamp}`}
                    >
                      <div className="flex items-center justify-end gap-2 font-mono text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">
                          {entry.timestamp}
                        </span>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => setSelectedEntry(entry)}
                          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                          title="Inspect audit record"
                          aria-label={`Inspect audit record: ${entry.action}`}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Audit Entry Dialog */}
      <Dialog
        open={selectedEntry !== null}
        onOpenChange={(open) => !open && setSelectedEntry(null)}
      >
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b border-border p-5 pr-12 pb-4">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <ScrollText className="size-4 shrink-0 text-primary" />
              <span className="truncate">
                Audit Record: {selectedEntry?.action}
              </span>
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Event ID: {selectedEntry?.id} • Timestamp:{" "}
              {selectedEntry?.timestamp}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/20 p-3 font-mono">
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <div className="font-semibold text-foreground uppercase">
                    {selectedEntry.category}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div
                    className={cn(
                      "font-semibold uppercase",
                      selectedEntry.status === "success"
                        ? "text-emerald-500"
                        : "text-destructive"
                    )}
                  >
                    {selectedEntry.status}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground">Actor:</span>
                  <div className="text-foreground">
                    {selectedEntry.actor.name} ({selectedEntry.actor.type})
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Target Resource:
                  </span>
                  <div className="text-foreground">{selectedEntry.target}</div>
                </div>
              </div>

              <div>
                <span className="font-mono text-xs font-semibold text-foreground">
                  Event Description & Payload
                </span>
                <p className="mt-1 rounded-md border border-border bg-muted/10 p-3 text-xs leading-relaxed text-foreground">
                  {selectedEntry.details}
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase">
                    Cryptographic Event Signature & Payload
                  </span>
                </div>

                <CodeHighlighter
                  language="json"
                  code={JSON.stringify(
                    {
                      ...selectedEntry,
                      transport: "grpc_mtls_v1",
                      signature: `sha256:${selectedEntry.id.replace("aud-", "")}89b1429f002`,
                      server_node: "tako-master-sg01",
                    },
                    null,
                    2
                  )}
                  maxHeight="max-h-64"
                  showCopy={true}
                  showLineNumbers={true}
                />
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 border-t border-border bg-muted/10 p-4">
            <DialogClose
              render={
                <Button size="sm" variant="outline">
                  Close
                </Button>
              }
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
