"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Boxes,
  FileCode2,
  Loader2,
  RotateCw,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePlatformData } from "@/context/platform-data-context"
import { ProjectService } from "@/types/platform"
import { activeStatusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"

interface ServiceTableProps {
  services: ProjectService[]
  onDelete?: (id: string) => void
}

export function ServiceTable({ services, onDelete }: ServiceTableProps) {
  const { triggerDeploy, activeDeployingId } = usePlatformData()

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-muted/30 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Node</th>
            <th className="px-4 py-3">Ports</th>
            <th className="px-4 py-3">RAM</th>
            <th className="px-4 py-3">Last Deployed</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {services.map((service) => {
            const isDeploying =
              activeDeployingId === service.id || service.status === "deploying"
            const isRunning = service.status === "running"

            return (
              <tr
                key={service.id}
                className="transition-colors hover:bg-muted/20"
              >
                <td
                  className="px-4 py-3 font-medium"
                  aria-label={`Service ${service.name}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded border border-border bg-muted/40 text-foreground">
                      {service.type === "dockerfile" ? (
                        <FileCode2 className="size-3.5 text-primary" />
                      ) : (
                        <Boxes className="size-3.5 text-emerald-500" />
                      )}
                    </div>
                    <div>
                      <Link
                        href={`/projects/${service.projectId}/services/${service.id}`}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {service.name}
                      </Link>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {service.slug}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] tracking-wider uppercase">
                    {service.type === "dockerfile" ? "Dockerfile" : "Compose"}
                  </span>
                </td>

                <td
                  className="px-4 py-3"
                  aria-label={`Status ${service.status}`}
                >
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px]">
                    {isDeploying ? (
                      <Loader2 className="size-3 animate-spin text-primary" />
                    ) : (
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          activeStatusDotClass(isRunning)
                        )}
                      />
                    )}
                    <span className="capitalize">
                      {isDeploying ? "Deploying" : service.status}
                    </span>
                  </div>
                </td>

                <td className="px-4 py-3 font-mono text-muted-foreground">
                  <span className="text-foreground">
                    {service.targetNodeId}
                  </span>
                </td>

                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {service.portMappings.length > 0 ? (
                    <span className="text-foreground">
                      {service.portMappings
                        .map((p) => `${p.host}:${p.container}`)
                        .join(", ")}
                    </span>
                  ) : (
                    "None"
                  )}
                </td>

                <td className="px-4 py-3 font-mono text-foreground">
                  {service.metrics.memoryMb} MB
                </td>

                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {service.lastDeployment.startedAt}
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={isDeploying}
                      onClick={() => triggerDeploy(service.id)}
                      className="h-7 gap-1 text-xs"
                    >
                      <RotateCw className="size-3 text-primary" />
                      <span>Deploy</span>
                    </Button>

                    <Link
                      href={`/projects/${service.projectId}/services/${service.id}`}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      <span>Console</span>
                      <ArrowRight className="size-3" />
                    </Link>

                    {onDelete && (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => onDelete(service.id)}
                        className="size-7 text-muted-foreground hover:text-destructive"
                        title="Delete service"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
