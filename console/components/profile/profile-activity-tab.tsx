"use client"

import * as React from "react"
import Link from "next/link"
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePlatformData } from "@/context/platform-data-context"

export function ProfileActivityTab() {
  const { auditLogs } = usePlatformData()

  // Filter logs associated with operator actions or take the recent logs
  const operatorLogs = auditLogs.slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Operator Activity & Security Audit Trail
              </h2>
              <span className="font-mono text-xs text-muted-foreground">
                Recent 10 Events
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Immutable ledger of control plane actions, credentials access, and
              cluster configuration dispatches.
            </p>
          </div>

          <Link href="/audit-logs">
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="gap-1.5 text-xs"
            >
              <span>View All Audit Logs</span>
              <ArrowUpRight className="size-3" />
            </Button>
          </Link>
        </div>

        {/* Activity Stream */}
        {operatorLogs.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            No activity records found for this operator account yet.
          </div>
        ) : (
          <div className="space-y-2">
            {operatorLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {log.status === "success" ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <ShieldAlert className="size-4 text-destructive" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {log.action}
                      </span>
                      <span className="py-0.2 rounded border border-primary/20 bg-primary/10 px-1.5 font-mono text-[10px] text-primary capitalize">
                        {log.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Target:{" "}
                      <strong className="font-mono text-foreground">
                        {log.target}
                      </strong>{" "}
                      — {log.details}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground sm:self-center">
                  <Clock className="size-3" />
                  <span>{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
