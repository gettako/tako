'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Server, AlertCircle } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ResourceBar } from '@/components/ui/resource-bar';
import { Node } from '@/lib/types';

export interface NodeSummaryWidgetProps {
  nodes: Node[];
}

export function NodeSummaryWidget({ nodes }: NodeSummaryWidgetProps) {
  return (
    <Card className="rounded-xl border border-border bg-card shadow-xs transition-colors overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-border/80 bg-muted/40 text-foreground shrink-0 shadow-2xs">
            <Server className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground truncate">
              Cluster Nodes
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground truncate mt-0.5">
              Physical hosts and virtual machines registered to Tako orchestrator
            </CardDescription>
          </div>
        </div>

        <CardAction>
          <Link
            href="/nodes"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline group shrink-0 active:not-aria-[haspopup]:translate-y-px"
          >
            <span>All Nodes ({nodes.length})</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-4">
        {nodes.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Server className="size-8 text-muted-foreground/60" />
            <span>No cluster nodes connected yet</span>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {nodes.map((node) => {
              const memoryPercent = Math.round(
                (node.usage.memoryUsedMb / node.usage.memoryLimitMb) * 100
              );

              return (
                <div
                  key={node.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col gap-2.5 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`size-2 rounded-full shrink-0 ${
                          node.status === 'online'
                            ? 'bg-status-success shadow-[0_0_8px_var(--status-success)]'
                            : 'bg-status-danger'
                        }`}
                      />
                      <Link
                        href={`/nodes/${node.id}`}
                        className="font-medium text-sm text-foreground hover:text-primary transition-colors truncate"
                      >
                        {node.name}
                      </Link>
                      <span className="hidden sm:inline font-mono text-xs text-muted-foreground shrink-0">
                        {node.ipAddress}
                      </span>
                    </div>

                    <StatusBadge status={node.status} size="sm" />
                  </div>

                  {node.status !== 'offline' ? (
                    <div className="grid grid-cols-2 gap-4 pt-0.5">
                      <ResourceBar
                        label="CPU"
                        value={node.usage.cpuPercent}
                        unit="%"
                        size="sm"
                        className="space-y-1"
                      />
                      <ResourceBar
                        label="RAM"
                        value={memoryPercent}
                        unit="%"
                        size="sm"
                        className="space-y-1"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md bg-status-danger/10 border border-status-danger/20 px-2.5 py-1 text-xs text-status-danger font-mono">
                      <AlertCircle className="size-3.5 shrink-0" />
                      <span>Host unreachable • Heartbeat signal lost</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
