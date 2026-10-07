'use client';

import React, { useState } from 'react';
import {
  Rocket,
  GitCommit,
  GitBranch,
  ArrowRight,
  Database,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  ScrollText,
  Clock,
  ShieldCheck,
  HardDrive,
  Eye,
  EyeOff,
  Key,
  AlertTriangle,
  RotateCw,
  Loader2,
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
  onRetryDeploy?: () => void;
}

export function RecentDeployCard({
  service,
  latestDeployment,
  onViewAllDeployments,
  onNavigateTab,
  onRetryDeploy,
}: RecentDeployCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRetry = async () => {
    if (!onRetryDeploy) return;
    try {
      setIsRetrying(true);
      await onRetryDeploy();
      toast.success('Retrying deployment pipeline...');
    } finally {
      setIsRetrying(false);
    }
  };

  // --- DATABASE SERVICE VIEW ---
  if (service.type === 'database') {
    const dbUser = 'tako_admin';
    const dbPass = 'p@ssw0rd123!';
    const dbHost = `${service.nodeName}.internal`;
    const dbPort = service.ports[0] || (service.databaseType === 'redis' ? 6379 : 5432);
    const dbName = service.name.replace(/-/g, '_');

    const connectionUri =
      service.connectionString ||
      (service.databaseType === 'redis'
        ? `redis://${dbHost}:${dbPort}`
        : `${service.databaseType || 'postgres'}://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`);

    const maskedUri =
      service.databaseType === 'redis'
        ? connectionUri
        : `${service.databaseType || 'postgres'}://${dbUser}:••••••••@${dbHost}:${dbPort}/${dbName}`;

    const cliCommand =
      service.databaseType === 'redis'
        ? `redis-cli -h ${dbHost} -p ${dbPort}`
        : service.databaseType === 'mysql'
        ? `mysql -h ${dbHost} -P ${dbPort} -u ${dbUser} -p`
        : `psql "${connectionUri}"`;

    return (
      <Card className="p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Database}
            title="Database Engine & Active Instance"
            description="Private cluster instance with automated persistence and snapshot policies"
            action={<StatusBadge status={service.status} size="sm" />}
          />
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <Database className="size-3 text-muted-foreground" />
                Engine & Version
              </span>
              <p className="font-semibold text-xs text-foreground capitalize">
                {service.databaseType || 'postgresql'} {service.databaseVersion || '16'}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <ShieldCheck className="size-3 text-muted-foreground" />
                Network Binding
              </span>
              <p className="font-mono text-xs text-foreground">
                {dbHost}:{dbPort}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <HardDrive className="size-3 text-muted-foreground" />
                Storage Volume
              </span>
              <p className="text-xs text-foreground font-mono">
                {service.usage.diskUsedGb || 1} GB / {service.limits.diskGb || 10} GB
              </p>
            </div>
          </div>

          {/* 1-Click Fast Connection URI Strip */}
          <div className="rounded-lg border border-border bg-background p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Key className="size-3.5 text-primary" />
                Direct Connection String
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-3.5 mr-1" /> : <Eye className="size-3.5 mr-1" />}
                  <span>{showPassword ? 'Mask' : 'Reveal'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(connectionUri, 'Connection URI')}
                  className="h-7 px-2.5 text-xs gap-1 border-border text-foreground hover:bg-muted"
                >
                  {copiedKey === 'Connection URI' ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  <span>{copiedKey === 'Connection URI' ? 'Copied' : 'Copy URI'}</span>
                </Button>
              </div>
            </div>

            <div className="rounded bg-muted/40 p-2 font-mono text-xs text-foreground select-all break-all border border-border/40">
              {showPassword ? connectionUri : maskedUri}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span className="font-mono text-[11px] truncate mr-2">CLI: {cliCommand}</span>
              <button
                type="button"
                onClick={() => handleCopy(cliCommand, 'CLI command')}
                className="text-primary hover:underline text-[11px] font-medium shrink-0"
              >
                {copiedKey === 'CLI command' ? 'Copied CLI' : 'Copy CLI command'}
              </button>
            </div>
          </div>

          {/* Database Actions */}
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
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab('backups')}
                  className="h-8 text-xs gap-1.5 border-border hover:bg-muted text-foreground"
                >
                  <HardDrive className="size-3.5 text-muted-foreground" />
                  <span>View Backups</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateTab('logs')}
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <ScrollText className="size-3.5" />
                  <span>Engine Logs</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateTab('terminal')}
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Terminal className="size-3.5" />
                  <span>CLI Terminal</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- APP / COMPOSE SERVICE VIEW ---
  const primaryCustomDomain = service.domains.find((d) => d.primary) || service.domains[0];
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

  const activeUrl = primaryCustomDomain ? `https://${primaryCustomDomain.domain}` : previewUrl;
  const isCustomDomain = !!primaryCustomDomain;

  const durationSec =
    latestDeployment?.durationMs && latestDeployment.durationMs > 0
      ? `${Math.max(1, Math.round(latestDeployment.durationMs / 1000))}s`
      : null;

  const isFailed = latestDeployment?.status === 'failed';
  const isBuilding =
    latestDeployment?.status === 'building' ||
    latestDeployment?.status === 'deploying' ||
    latestDeployment?.status === 'queued';
  const failedStep = latestDeployment?.steps?.find((s) => s.status === 'failed');
  const runningStep = latestDeployment?.steps?.find((s) => s.status === 'running');

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
                  <span>Build History</span>
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
            {/* 1. FAILURE ALERT BANNER (If deployment failed) */}
            {isFailed && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-md border border-destructive/30 bg-background text-destructive shrink-0">
                    <AlertTriangle className="size-4 text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-destructive uppercase tracking-wide">
                        Deployment Pipeline Failed
                      </span>
                      {failedStep && (
                        <span className="rounded bg-destructive/20 px-1.5 py-0.5 font-mono text-[10px] text-destructive">
                          Failed step: {failedStep.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The latest build could not be deployed. Check build logs to identify errors.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {onViewAllDeployments && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onViewAllDeployments}
                      className="h-8 px-3 text-xs gap-1.5 border-border hover:bg-muted text-foreground"
                    >
                      <Terminal className="size-3.5 text-destructive" />
                      <span>Inspect Logs</span>
                    </Button>
                  )}
                  {onRetryDeploy && (
                    <Button
                      size="sm"
                      onClick={handleRetry}
                      disabled={isRetrying}
                      className="h-8 px-3 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isRetrying ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="size-3.5" />
                      )}
                      <span>Retry Deploy</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 2. BUILDING/DEPLOYING IN PROGRESS BANNER */}
            {isBuilding && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-md border border-primary/30 bg-background text-primary shrink-0">
                    <Loader2 className="size-4 animate-spin text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                        Deployment in Progress
                      </span>
                      {runningStep && (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                          Stage: {runningStep.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Compiling assets and updating container instances...
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {onViewAllDeployments && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onViewAllDeployments}
                      className="h-8 px-3 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <Terminal className="size-3.5" />
                      <span>Stream Live Logs</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 3. ACTIVE LIVE ENDPOINT BANNER (When healthy / not failed) */}
            {!isFailed && activeUrl && (
              <div className="rounded-lg border border-border bg-muted/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shrink-0">
                    <ExternalLink className="size-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {isCustomDomain ? 'Production Custom Domain' : 'Automatic Preview Endpoint'}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                        {isCustomDomain ? 'TLS / Custom' : 'sslip.io'}
                      </span>
                    </div>
                    <a
                      href={activeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-foreground font-semibold hover:underline truncate block"
                      title={activeUrl}
                    >
                      {activeUrl}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(activeUrl, 'Endpoint URL')}
                    className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    title="Copy URL"
                  >
                    {copiedKey === 'Endpoint URL' ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    <span>{copiedKey === 'Endpoint URL' ? 'Copied' : 'Copy'}</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={activeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                    className="h-8 px-3 text-xs gap-1.5 border-border hover:bg-muted text-foreground"
                  >
                    <ExternalLink className="size-3.5 text-primary" />
                    <span>Open App</span>
                  </Button>

                  {/* Runtime Logs Button (Direct Jump!) */}
                  {onNavigateTab && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigateTab('logs')}
                      className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      title="View runtime container logs"
                    >
                      <ScrollText className="size-3.5" />
                      <span>Runtime Logs</span>
                    </Button>
                  )}

                  {/* Build Logs Button */}
                  {onViewAllDeployments && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onViewAllDeployments}
                      className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      title="View build pipeline logs"
                    >
                      <Terminal className="size-3.5" />
                      <span>Build Logs</span>
                    </Button>
                  )}

                  {/* Web Terminal Button */}
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

            {/* Pipeline Stages Bar */}
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
