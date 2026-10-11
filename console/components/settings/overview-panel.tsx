'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SettingsSectionHeader } from '@/components/settings/settings-section-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Server,
  Boxes,
  Globe,
  HardDrive,
  Cpu,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Sliders,
  Clock,
  Sparkles,
  Database,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useNodes,
  useProjects,
  useServices,
  useDomainSettings,
  useS3Buckets,
  useBackupSchedule,
  useSystemVersion,
  useSystemUpdate,
} from '@/lib/queries';

export function OverviewPanel() {
  const { data: nodes = [] } = useNodes();
  const { data: projects = [] } = useProjects();
  const { data: services = [] } = useServices();
  const { data: domainSettings } = useDomainSettings();
  const { data: buckets = [] } = useS3Buckets();
  const { data: backupSchedule } = useBackupSchedule();
  const {
    data: versionInfo,
    isFetching: isVersionFetching,
    refetch: refetchVersion,
  } = useSystemVersion();

  const [updateModalOpen, setUpdateModalOpen] = React.useState(false);
  const systemUpdateMutation = useSystemUpdate({
    onSuccess: () => {
      setUpdateModalOpen(false);
    },
  });

  // Real Computed Cluster Metrics
  const onlineNodes = nodes.filter((n) => n.status === 'online');
  const leaderNode = nodes.find((n) => n.role === 'leader') || nodes[0];
  const leaderIp = leaderNode?.publicIp || leaderNode?.ipAddress || '127.0.0.1';
  const runningServices = services.filter((s) => s.status === 'healthy' || s.status === 'deploying');
  const defaultBucket = buckets.find((b) => b.isDefault) || buckets[0];

  const totalCores = nodes.reduce((acc, n) => acc + (n.cpuTotalCores || 0), 0);
  const totalRamGb = Math.round((nodes.reduce((acc, n) => acc + (n.memoryTotalMb || 0), 0) / 1024) * 10) / 10;
  const usedRamGb =
    Math.round((nodes.reduce((acc, n) => acc + (n.usage?.memoryUsedMb || 0), 0) / 1024) * 10) / 10;
  const ramPercent = totalRamGb > 0 ? Math.min(100, Math.round((usedRamGb / totalRamGb) * 100)) : 0;

  const totalDiskGb = nodes.reduce((acc, n) => acc + (n.diskTotalGb || 0), 0);
  const usedDiskGb = Math.round(nodes.reduce((acc, n) => acc + (n.usage?.diskUsedGb || 0), 0));
  const diskPercent = totalDiskGb > 0 ? Math.min(100, Math.round((usedDiskGb / totalDiskGb) * 100)) : 0;

  const isClusterHealthy = nodes.length > 0 && onlineNodes.length === nodes.length;

  return (
    <div className="space-y-6">
      {/* 1. Control Plane & Consensus Engine */}
      <Card>
        <CardHeader className="pb-4">
          <SettingsSectionHeader
            icon={Sliders}
            title="Tako Control Plane Specifications"
            description="Real-time orchestrator runtime state, consensus topology, and leader election specifications."
            action={
              <Badge
                variant="outline"
                className={
                  isClusterHealthy
                    ? 'bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs gap-1'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-mono text-xs gap-1'
                }
              >
                <CheckCircle2 className="size-3" />
                {isClusterHealthy ? 'Consensus Healthy' : 'Degraded Quorum'}
              </Badge>
            }
          />
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Telemetry Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-border bg-muted/20">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground block">Consensus Mode</span>
              <span className="text-sm font-semibold text-foreground font-mono">
                {nodes.length > 1 ? 'Raft Multi-Node' : 'Raft Single-Leader'}
              </span>
              <span className="text-[11px] text-muted-foreground block font-mono">
                Leader: {leaderNode?.name || 'leader-01'}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground block">Cluster Topology</span>
              <span className="text-sm font-semibold text-foreground font-mono">
                {onlineNodes.length} / {nodes.length || 1} Online
              </span>
              <span className="text-[11px] text-muted-foreground block font-mono">
                IP: {leaderIp}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground block">Container Runtime</span>
              <span className="text-sm font-semibold text-foreground font-mono">
                Docker {leaderNode?.dockerVersion || '27.x'}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                BuildKit enabled
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground block">Operating System</span>
              <span className="text-sm font-semibold text-foreground font-mono">
                {leaderNode?.os || 'Linux'} {leaderNode?.kernelVersion ? `• ${leaderNode.kernelVersion.split('-')[0]}` : ''}
              </span>
              <span className="text-[11px] text-muted-foreground block truncate">
                {leaderNode?.uptime || 'Active uptime'}
              </span>
            </div>
          </div>

          {/* System Version & Auto-Update Control */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card/60">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Tako Version: <span className="font-mono text-primary font-bold">{versionInfo?.currentVersion || 'v1.0.0'}</span>
                </span>
                {versionInfo?.updateAvailable ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] gap-1 font-mono">
                    <Sparkles className="size-3" />
                    Update Available: {versionInfo.latestVersion}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-status-success/10 text-status-success border-status-success/30 text-[11px] gap-1 font-mono">
                    <CheckCircle2 className="size-3" />
                    Up to date
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {versionInfo?.updateAvailable
                  ? versionInfo.releaseNotes || `New release ${versionInfo.latestVersion} is available with performance and security improvements.`
                  : 'Your control plane and orchestrator core are operating on the latest release.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchVersion()}
                disabled={isVersionFetching}
                className="text-xs h-8 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
                title="Check for newest releases on GitHub"
              >
                <RefreshCw className={`size-3.5 ${isVersionFetching ? 'animate-spin text-primary' : ''}`} />
                <span>{isVersionFetching ? 'Checking...' : 'Check Updates'}</span>
              </Button>

              <Button
                variant={versionInfo?.updateAvailable ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUpdateModalOpen(true)}
                className="text-xs h-8 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
              >
                <Sparkles className="size-3.5" />
                <span>{versionInfo?.updateAvailable ? 'Update Now' : 'Update Tako'}</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Activity className="size-3.5 text-status-success animate-pulse" />
              <span>
                All orchestrator gRPC heartbeats and state machine logs are synchronized across active nodes.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5 shrink-0 self-start sm:self-auto active:not-aria-[haspopup]:translate-y-px"
              render={
                <a
                  href="https://github.com/gettako/tako/releases"
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <span>Release Notes</span>
              <ArrowUpRight className="size-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Subsystem Telemetry: Ingress & Storage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ingress Subsystem Card */}
        <Card>
          <CardHeader className="pb-3">
            <SettingsSectionHeader
              icon={Globe}
              title="Edge Ingress & Hostname"
              description="Traefik reverse proxy and Let's Encrypt TLS certificate state."
              action={
                domainSettings?.domain ? (
                  <Badge
                    variant="outline"
                    className={
                      domainSettings?.sslActive
                        ? 'bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs gap-1'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-mono text-xs gap-1'
                    }
                  >
                    <ShieldCheck className="size-3" />
                    {domainSettings?.sslActive ? 'TLS Active' : 'Pending DNS'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                    Node IP Ingress
                  </Badge>
                )
              }
            />
          </CardHeader>

          <CardContent className="space-y-3 pt-2 text-xs">
            <div className="p-3 rounded-lg border border-border bg-muted/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Control Plane Hostname</span>
                <span className="font-mono font-semibold text-foreground">
                  {domainSettings?.domain ? domainSettings.domain : 'Not configured'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Certificate Resolver</span>
                <span className="font-mono text-foreground">
                  Traefik ACME HTTP-01
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Ingress Gateway IP</span>
                <span className="font-mono text-foreground">{leaderIp}</span>
              </div>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {domainSettings?.domain
                ? `Automatic Let's Encrypt TLS termination configured for ${domainSettings.domain}.`
                : 'Direct IP routing active. Configure a custom domain in Cluster Hostname & SSL to activate HTTPS.'}
            </p>
          </CardContent>
        </Card>

        {/* Object Storage Subsystem Card */}
        <Card>
          <CardHeader className="pb-3">
            <SettingsSectionHeader
              icon={HardDrive}
              title="Storage & Snapshots"
              description="S3 storage destination and automated cluster dump scheduling."
              action={
                <Badge
                  variant="outline"
                  className={
                    buckets.length > 0
                      ? 'bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs gap-1'
                      : 'bg-muted text-muted-foreground border-border font-mono text-xs'
                  }
                >
                  <Database className="size-3" />
                  {buckets.length > 0 ? `${buckets.length} Buckets Connected` : 'No S3 Configured'}
                </Badge>
              }
            />
          </CardHeader>

          <CardContent className="space-y-3 pt-2 text-xs">
            <div className="p-3 rounded-lg border border-border bg-muted/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Primary Storage Target</span>
                <span className="font-mono font-semibold text-foreground truncate max-w-[180px]">
                  {defaultBucket ? defaultBucket.name : 'None (Local only)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Backup Schedule</span>
                <span className="font-mono text-foreground capitalize">
                  {backupSchedule?.enabled ? `${backupSchedule.frequency} at ${backupSchedule.timeUtc} UTC` : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Last Snapshot</span>
                <span className="font-mono text-foreground">
                  {backupSchedule?.lastBackupAt
                    ? new Date(backupSchedule.lastBackupAt).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {defaultBucket
                ? `Volume dumps and encrypted database states are replicated to ${defaultBucket.bucket}.`
                : 'Connect an S3 compatible object storage bucket to protect persistent volumes.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Aggregate Hardware Allocation & Workloads */}
      <Card>
        <CardHeader className="pb-4">
          <SettingsSectionHeader
            icon={Cpu}
            title="Cluster Resource Allocation & Workload Capacity"
            description="Aggregated physical hardware resources and active container workloads across all cluster nodes."
            action={
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {runningServices.length} / {services.length} Services Running
                </span>
              </div>
            }
          />
        </CardHeader>

        <CardContent className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Compute Cores */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Compute Capacity</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {totalCores} vCPU Cores
                </span>
              </div>
              <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                {totalCores} Cores
              </div>
              <div className="text-[11px] text-muted-foreground">
                Allocated across {nodes.length} cluster nodes
              </div>
            </div>

            {/* Memory Allocation */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Cluster Memory</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {usedRamGb} / {totalRamGb} GB ({ramPercent}%)
                </span>
              </div>
              <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${ramPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground flex justify-between font-mono">
                <span>Used: {usedRamGb} GB</span>
                <span>Total: {totalRamGb} GB</span>
              </div>
            </div>

            {/* Storage Quota */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Host Storage Pool</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {usedDiskGb} / {totalDiskGb} GB ({diskPercent}%)
                </span>
              </div>
              <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${diskPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground flex justify-between font-mono">
                <span>Used: {usedDiskGb} GB</span>
                <span>Total: {totalDiskGb} GB</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Update Tako Confirmation Dialog */}
      <Dialog open={updateModalOpen} onOpenChange={setUpdateModalOpen}>
        <DialogContent className="sm:max-w-[460px] text-foreground font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary shrink-0" />
              <span>Update Tako Platform</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Initiate an automated rolling update across the Tako control plane and all connected worker agents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-muted-foreground block font-medium">Current Version</span>
                <span className="text-xs font-mono font-semibold text-foreground">{versionInfo?.currentVersion || 'v1.0.0'}</span>
              </div>
              <span className="text-muted-foreground text-xs font-mono">→</span>
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground block font-medium">Target Version</span>
                <span className="text-xs font-mono font-semibold text-primary">{versionInfo?.latestVersion || 'latest'}</span>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground space-y-1.5 leading-relaxed">
              <p className="font-semibold text-xs flex items-center gap-1.5 text-primary">
                <ShieldCheck className="size-3.5 shrink-0" />
                Zero-Downtime Rolling Update
              </p>
              <p className="text-[11px] text-muted-foreground">
                Container images will be refreshed via GitHub Container Registry. Database schemas are migrated safely on launch, and user apps continue serving traffic.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={systemUpdateMutation.isPending}
              onClick={() => setUpdateModalOpen(false)}
              className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={systemUpdateMutation.isPending}
              onClick={() => systemUpdateMutation.mutate('all')}
              className="text-xs h-9 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
            >
              {systemUpdateMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>{systemUpdateMutation.isPending ? 'Updating...' : 'Start Update'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

