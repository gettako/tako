'use client';

import React, { useState } from 'react';
import {
  Rocket,
  GitCommit,
  GitBranch,
  ArrowRight,
  Database,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  Clock,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { StepBadgeBar } from '../deployments/step-badge-bar';
import { Deployment, Service } from '@/lib/types';
import { toast } from 'sonner';

export interface RecentDeployCardProps {
  service: Service;
  latestDeployment?: Deployment | null;
  onViewAllDeployments?: () => void;
  onNavigateTab?: (tabId: string) => void;
}

export function RecentDeployCard({
  service,
  latestDeployment,
  onViewAllDeployments,
  onNavigateTab,
}: RecentDeployCardProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success('Preview URL copied to clipboard');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (service.type === 'database') {
    return (
      <Card className="p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Database}
            title="Database Engine & Cluster"
            description="High-availability managed instance and automated snapshot policies"
            action={<StatusBadge status={service.status} size="sm" />}
          />
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <Database className="size-3 text-muted-foreground" />
                Engine
              </span>
              <p className="font-semibold text-xs text-foreground capitalize">
                {service.databaseType || 'postgresql'} {service.databaseVersion || '16'}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <ShieldCheck className="size-3 text-muted-foreground" />
                Snapshot Policy
              </span>
              <p className="font-mono text-xs text-foreground">Daily at 03:00 UTC</p>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <CheckCircle2 className="size-3 text-emerald-500" />
                Last Backup
              </span>
              <p className="text-xs text-foreground font-mono">Today, 03:00 UTC</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-border">
            {onNavigateTab && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab('connection')}
                  className="h-8 text-xs gap-1.5 border-border hover:bg-muted text-foreground"
                >
                  <Database className="size-3.5 text-muted-foreground" />
                  <span>Connection Details</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateTab('backups')}
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <HardDrive className="size-3.5" />
                  <span>View Backups</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const commitHashPrefix = (
    latestDeployment?.commitHash ||
    service.commitHash ||
    'preview'
  )
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);

  const previewUrl =
    latestDeployment?.previewUrl ||
    (service.commitHash ? `http://${commitHashPrefix}-127-0-0-1.sslip.io` : null);

  const durationSec =
    latestDeployment?.durationMs && latestDeployment.durationMs > 0
      ? `${Math.max(1, Math.round(latestDeployment.durationMs / 1000))}s`
      : null;

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={Rocket}
          title="Active Production Release"
          description="Current running build version and deployment pipeline"
          action={
            <div className="flex items-center gap-2.5">
              <StatusBadge
                status={latestDeployment?.status || service.status}
                size="sm"
              />
              {onViewAllDeployments && (
                <button
                  type="button"
                  onClick={onViewAllDeployments}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline ml-1"
                >
                  <span>History & Logs</span>
                  <ArrowRight className="size-3" />
                </button>
              )}
            </div>
          }
        />
      </CardHeader>

      <CardContent className="p-0 space-y-4">
        {latestDeployment ? (
          <>
            {/* Live Routing & Preview Endpoint Banner */}
            {previewUrl && (
              <div className="rounded-lg border border-border bg-muted/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shrink-0">
                    <ExternalLink className="size-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Routing Preview Endpoint
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                        sslip.io
                      </span>
                    </div>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-foreground font-medium hover:underline truncate block"
                      title={previewUrl}
                    >
                      {previewUrl}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyUrl(previewUrl)}
                    className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    title="Copy preview URL"
                  >
                    {copiedUrl ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                    className="h-8 px-3 text-xs gap-1.5 border-border hover:bg-muted text-foreground"
                  >
                    <ExternalLink className="size-3.5 text-primary" />
                    <span>Open Preview</span>
                  </Button>

                  {onViewAllDeployments && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onViewAllDeployments}
                      className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      title="View build logs"
                    >
                      <Terminal className="size-3.5" />
                      <span>Logs</span>
                    </Button>
                  )}

                  {onNavigateTab && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigateTab('terminal')}
                      className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      title="Open interactive terminal"
                    >
                      <span>Terminal</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Commit & Build Metadata Box */}
            <div className="rounded-lg border border-border bg-background p-3.5 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground border border-border/50">
                    <GitCommit className="size-3 text-muted-foreground" />
                    {latestDeployment.commitHash.substring(0, 7)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    <GitBranch className="size-3 text-muted-foreground" />
                    {latestDeployment.branch}
                  </span>
                  <span className="text-xs text-foreground font-medium line-clamp-1">
                    {latestDeployment.commitMessage}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono shrink-0">
                  <span>by {latestDeployment.author}</span>
                  {durationSec && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {durationSec}
                    </span>
                  )}
                  <span>
                    {new Date(latestDeployment.startedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Cloudflare-Style Deployment Pipeline Stages Bar */}
            {latestDeployment.steps && latestDeployment.steps.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Pipeline Stages</span>
                  {onViewAllDeployments && (
                    <button
                      type="button"
                      onClick={onViewAllDeployments}
                      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Inspect Stage Logs &rarr;
                    </button>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-muted/10 p-2.5">
                  <StepBadgeBar
                    deployment={latestDeployment}
                    onSelectStep={() => onViewAllDeployments?.()}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No deployment recorded yet for this service.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
