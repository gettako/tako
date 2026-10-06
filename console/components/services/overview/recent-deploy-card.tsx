'use client';

import React from 'react';
import { Rocket, GitCommit, ArrowRight, Database, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Deployment, Service } from '@/lib/types';

export interface RecentDeployCardProps {
  service: Service;
  latestDeployment?: Deployment | null;
  onViewAllDeployments?: () => void;
}

export function RecentDeployCard({
  service,
  latestDeployment,
  onViewAllDeployments,
}: RecentDeployCardProps) {
  if (service.type === 'database') {
    return (
      <Card className="p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Database}
            title="Database Engine Status"
            description="High-availability cluster & automated snapshot policy"
            action={<StatusBadge status={service.status} size="sm" />}
          />
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Engine</span>
            <span className="font-semibold text-foreground capitalize">
              {service.databaseType} {service.databaseVersion || '16'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Snapshot Policy</span>
            <span className="font-mono text-foreground">Daily at 03:00 UTC (S3 R2)</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last Backup</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="size-3" />
              Today, 03:00 UTC (Success)
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={Rocket}
          title="Active Release"
          description="Current running build version and revision metadata"
          action={
            onViewAllDeployments ? (
              <button
                onClick={onViewAllDeployments}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <span>History</span>
                <ArrowRight className="size-3" />
              </button>
            ) : undefined
          }
        />
      </CardHeader>

      <CardContent className="p-0">
        {latestDeployment ? (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                  <GitCommit className="size-3" />
                  {latestDeployment.commitHash.substring(0, 7)}
                </span>
                <span className="font-mono text-muted-foreground">
                  {latestDeployment.branch}
                </span>
              </div>
              <StatusBadge status={latestDeployment.status} size="sm" />
            </div>

            <p className="text-xs text-foreground font-medium line-clamp-1">
              {latestDeployment.commitMessage}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] text-muted-foreground font-mono">
              <span>Deployed by {latestDeployment.author}</span>
              <span>
                {new Date(latestDeployment.startedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No deployment recorded yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
