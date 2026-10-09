'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, GitCommit, Rocket, Timer } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Deployment } from '@/lib/types';

export interface RecentDeploymentsWidgetProps {
  deployments: Deployment[];
}

export function RecentDeploymentsWidget({ deployments }: RecentDeploymentsWidgetProps) {
  const [mounted, setMounted] = useState(false);
  const latestDeployments = deployments.slice(0, 5);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Card className="rounded-xl border border-border bg-card transition-colors overflow-hidden">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground shrink-0">
              <Rocket className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground truncate">
                Recent Deployments
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground truncate mt-0.5">
                Latest release pipelines across cluster workloads
              </CardDescription>
            </div>
          </div>

          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline group shrink-0 self-start sm:self-auto"
          >
            <span>View Projects</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {latestDeployments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Rocket className="size-8 text-muted-foreground/60" />
            <span>No deployment pipelines recorded yet</span>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {latestDeployments.map((dep) => {
              const formattedTime = mounted
                ? new Date(dep.startedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '--:--';

              return (
                <div
                  key={dep.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 transition-colors group"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/services/${dep.serviceId}`}
                        className="font-medium text-sm text-foreground hover:text-primary transition-colors truncate"
                      >
                        {dep.serviceName}
                      </Link>
                      <span className="inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        <GitCommit className="size-2.5" />
                        {(dep.commitHash || 'main').substring(0, 7)}
                      </span>
                      <span className="hidden sm:inline font-mono text-xs text-muted-foreground/80 truncate">
                        {dep.branch}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-md">
                      {dep.commitMessage}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {formattedTime}
                      </div>
                      {dep.durationMs && (
                        <div className="text-[10px] text-muted-foreground/80 font-mono flex items-center justify-end gap-0.5">
                          <Timer className="size-2.5" />
                          <span>{Math.round(dep.durationMs / 1000)}s</span>
                        </div>
                      )}
                    </div>
                    <StatusBadge status={dep.status} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
