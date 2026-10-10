'use client';

import React, { useState, useEffect } from 'react';
import { Node } from '@/lib/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/ui/copy-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Clock,
  RotateCw,
  Cpu,
  Layers,
  HardDrive,
  Pencil,
  Loader2,
  Power,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateNode, useRebootNode } from '@/lib/queries';

interface NodeSpecHeaderProps {
  node: Node;
  onRefresh?: () => void;
}

export function formatHostMemory(totalMb: number): string {
  if (!totalMb || totalMb <= 0) return '0 GiB';
  const gib = totalMb / 1024;
  const formatted = gib % 1 === 0 ? gib.toFixed(0) : gib.toFixed(2);
  return `${formatted} GiB host RAM`;
}

function formatSecondsToDuration(seconds: number): string {
  if (seconds <= 0) return '0s';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    if (hours > 0) return `${days}d ${hours}h ${minutes}m`;
    return `${days}d ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatUptime(uptime: string | number | undefined | null): string {
  if (!uptime) return '0s';
  if (typeof uptime === 'number') {
    return formatSecondsToDuration(uptime);
  }

  const trimmed = uptime.trim();
  const match = trimmed.match(/^(\d+)(?:s|sec|seconds)?$/i);
  if (match) {
    const totalSeconds = parseInt(match[1], 10);
    if (!isNaN(totalSeconds)) {
      return formatSecondsToDuration(totalSeconds);
    }
  }

  return trimmed;
}

export function NodeSpecHeader({ node, onRefresh }: NodeSpecHeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit Node Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [editPrivateIp, setEditPrivateIp] = useState(node.ipAddress);
  const [editPublicIp, setEditPublicIp] = useState(node.publicIp || '');

  useEffect(() => {
    if (editDialogOpen) {
      setEditName(node.name);
      setEditPrivateIp(node.ipAddress);
      setEditPublicIp(node.publicIp || '');
    }
  }, [editDialogOpen, node]);

  const [rebootDialogOpen, setRebootDialogOpen] = useState(false);

  const updateMutation = useUpdateNode({
    onSuccess: () => {
      setEditDialogOpen(false);
      if (onRefresh) onRefresh();
    },
  });

  const rebootMutation = useRebootNode({
    onSuccess: () => {
      setRebootDialogOpen(false);
      if (onRefresh) onRefresh();
    },
  });

  const handleRefreshClick = () => {
    if (onRefresh) {
      setIsRefreshing(true);
      onRefresh();
      toast.success('Refreshing node telemetry');
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
              {node.name}
            </h1>
            <StatusBadge status={node.status} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>Node ID: {node.id}</span>
            <span>•</span>
            <span>Docker v{node.dockerVersion}</span>
            <span>•</span>
            <span className="truncate">{node.os}</span>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDialogOpen(true)}
            className="text-xs gap-1.5 h-9 active:not-aria-[haspopup]:translate-y-px"
          >
            <Pencil className="size-3.5" />
            <span>Edit Node</span>
          </Button>

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshClick}
              className="text-xs gap-1.5 h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              <RotateCw
                className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`}
              />
              <span>Refresh</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRebootDialogOpen(true)}
            className="text-xs gap-1.5 h-9 text-status-danger hover:text-status-danger border-border hover:border-status-danger/40 hover:bg-status-danger/5 active:not-aria-[haspopup]:translate-y-px"
          >
            <Power className="size-3.5" />
            <span>Reboot Node</span>
          </Button>
        </div>
      </div>

      {/* 2. Hardware & Network Telemetry Grid */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6 text-xs">
          {/* Private IP */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium">Private IP</span>
            <div className="flex items-center gap-1.5 font-mono text-foreground font-medium text-xs">
              <span>{node.ipAddress}</span>
              <CopyButton
                text={node.ipAddress}
                tooltip="Copy Private IP"
                className="size-5 text-muted-foreground hover:text-foreground"
              />
            </div>
          </div>

          {/* Public IP */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium">Public IP</span>
            <div className="flex items-center gap-1.5 font-mono text-foreground font-medium text-xs">
              <span>{node.publicIp || 'None'}</span>
              {node.publicIp && (
                <CopyButton
                  text={node.publicIp}
                  tooltip="Copy Public IP"
                  className="size-5 text-muted-foreground hover:text-foreground"
                />
              )}
            </div>
          </div>

          {/* CPU Cores */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Cpu className="size-3 text-primary" />
              Compute Cores
            </span>
            <div className="font-mono text-foreground font-medium text-xs">
              {node.cpuTotalCores} vCPU threads
            </div>
          </div>

          {/* Host Memory */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Layers className="size-3 text-status-success" />
              Memory Limit
            </span>
            <div className="font-mono text-foreground font-medium text-xs">
              {formatHostMemory(node.memoryTotalMb)}
            </div>
          </div>

          {/* Persistent Disk */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <HardDrive className="size-3 text-status-warning" />
              Storage Volume
            </span>
            <div className="font-mono text-foreground font-medium text-xs">
              {node.diskTotalGb >= 10 ? Math.round(node.diskTotalGb) : node.diskTotalGb.toFixed(1)} GB NVMe/SSD
            </div>
          </div>

          {/* System Uptime */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Clock className="size-3" />
              System Uptime
            </span>
            <div className="font-medium text-foreground text-xs truncate" title={node.uptime}>
              {formatUptime(node.uptime)}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Node Specifications Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Node Specifications</DialogTitle>
            <DialogDescription>
              Update cluster networking addresses and display name for this node.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: node.id,
                input: {
                  name: editName,
                  ipAddress: editPrivateIp,
                  publicIp: editPublicIp,
                },
              });
            }}
            className="space-y-4 py-1"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Node Hostname / Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. tako-worker-01"
                className="h-8 text-xs font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Private IP (Internal LAN)</label>
                <span className="text-[10px] text-muted-foreground">e.g. eth0 interface</span>
              </div>
              <Input
                value={editPrivateIp}
                onChange={(e) => setEditPrivateIp(e.target.value)}
                placeholder="e.g. 10.3.19.31 or 192.168.1.10"
                className="h-8 text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Internal cluster interface IP (from <code>ip -br addr show</code>).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Public IP (External)</label>
                <span className="text-[10px] text-muted-foreground">WAN / Internet</span>
              </div>
              <Input
                value={editPublicIp}
                onChange={(e) => setEditPublicIp(e.target.value)}
                placeholder="e.g. 43.156.243.241"
                className="h-8 text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Public IPv4 used by Traefik routing and domain DNS records.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(false)}
                className="text-xs h-8 active:not-aria-[haspopup]:translate-y-px"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateMutation.isPending}
                className="text-xs h-8 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
              >
                {updateMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                <span>Save Changes</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reboot Node Confirmation Dialog */}
      <Dialog open={rebootDialogOpen} onOpenChange={setRebootDialogOpen}>
        <DialogContent className="sm:max-w-[440px] text-foreground font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-danger text-base">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Reboot Node</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Are you sure you want to reboot <strong className="text-foreground">{node.name}</strong> ({node.ipAddress})?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 p-3 text-status-danger space-y-1.5 leading-relaxed">
              <p className="font-semibold text-xs flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0" />
                Temporary Service Interruption
              </p>
              <p className="text-[11px] text-muted-foreground">
                All running containers and services hosted on this node will experience temporary downtime until the host system finishes rebooting and the tako agent reconnects.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rebootMutation.isPending}
              onClick={() => setRebootDialogOpen(false)}
              className="text-xs h-8 active:not-aria-[haspopup]:translate-y-px"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={rebootMutation.isPending}
              onClick={() => rebootMutation.mutate(node.id)}
              className="text-xs h-8 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
            >
              {rebootMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Power className="size-3.5" />
              )}
              <span>{rebootMutation.isPending ? 'Rebooting...' : 'Reboot Now'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
