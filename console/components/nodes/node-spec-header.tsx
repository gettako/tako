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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  MoreHorizontal,
} from 'lucide-react';
import { FieldError } from '@/components/ui/field';
import { parseApiError } from '@/lib/form-errors';
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) setGeneralError('');
  };

  useEffect(() => {
    if (editDialogOpen) {
      setEditName(node.name);
      setEditPrivateIp(node.ipAddress);
      setEditPublicIp(node.publicIp || '');
      setFieldErrors({});
      setGeneralError('');
    }
  }, [editDialogOpen, node]);

  const [rebootDialogOpen, setRebootDialogOpen] = useState(false);

  const updateMutation = useUpdateNode({
    onSuccess: () => {
      setEditDialogOpen(false);
      if (onRefresh) onRefresh();
    },
    onError: (err) => {
      const parsed = parseApiError(err);
      if (parsed.is422) {
        setFieldErrors(parsed.fieldErrors);
        setGeneralError(parsed.message || 'Validation failed');
      } else {
        toast.error(parsed.message || 'Failed to update node');
      }
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
    <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-primary/5 via-background to-background p-5 sm:p-6 shadow-2xs space-y-5">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
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
            <Pencil className="size-3.5 text-muted-foreground" />
            <span>Edit Node</span>
          </Button>

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="text-xs gap-1.5 h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              <RotateCw
                className={`size-3.5 text-muted-foreground ${isRefreshing ? 'animate-spin text-primary' : ''}`}
              />
              <span>Refresh</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 active:not-aria-[haspopup]:translate-y-px"
                  title="More node actions"
                >
                  <MoreHorizontal className="size-4 text-muted-foreground" />
                  <span className="sr-only">More actions</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setRebootDialogOpen(true)}
                className="text-xs gap-2 text-status-danger focus:text-status-danger focus:bg-status-danger/10 cursor-pointer"
              >
                <Power className="size-3.5" />
                <span>Reboot Node...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. Hardware & Network Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-4 border-t border-border/60 text-xs">
        {/* Private IP */}
        <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium block">Private IP</span>
          <div className="flex items-center justify-between gap-1 font-mono text-foreground font-medium text-xs">
            <span className="truncate">{node.ipAddress}</span>
            <CopyButton
              text={node.ipAddress}
              tooltip="Copy Private IP"
              className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
            />
          </div>
        </div>

        {/* Public IP */}
        <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium block">Public IP</span>
          <div className="flex items-center justify-between gap-1 font-mono text-foreground font-medium text-xs">
            <span className="truncate">{node.publicIp || 'None'}</span>
            {node.publicIp && (
              <CopyButton
                text={node.publicIp}
                tooltip="Copy Public IP"
                className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
              />
            )}
          </div>
        </div>

        {/* CPU Cores */}
        <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <Cpu className="size-3 text-muted-foreground" />
            Compute Cores
          </span>
          <div className="font-mono text-foreground font-medium text-xs">
            {node.cpuTotalCores} vCPU threads
          </div>
        </div>

        {/* Host Memory */}
        <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <Layers className="size-3 text-muted-foreground" />
            Memory Limit
          </span>
          <div className="font-mono text-foreground font-medium text-xs">
            {formatHostMemory(node.memoryTotalMb)}
          </div>
        </div>

        {/* Persistent Disk */}
        <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <HardDrive className="size-3 text-muted-foreground" />
            Storage Volume
          </span>
          <div className="font-mono text-foreground font-medium text-xs">
            {node.diskTotalGb >= 10 ? Math.round(node.diskTotalGb) : node.diskTotalGb.toFixed(1)} GB NVMe
          </div>
        </div>

        {/* System Uptime */}
        <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground" />
            System Uptime
          </span>
          <div className="font-medium text-foreground text-xs truncate" title={node.uptime}>
            {formatUptime(node.uptime)}
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
              const errors: Record<string, string> = {};
              if (!editName.trim()) {
                errors.name = 'Node hostname/name is required';
              }
              if (!editPrivateIp.trim()) {
                errors.ipAddress = 'Private IP address is required';
              }
              if (Object.keys(errors).length > 0) {
                setFieldErrors(errors);
                return;
              }

              updateMutation.mutate({
                id: node.id,
                input: {
                  name: editName.trim(),
                  ipAddress: editPrivateIp.trim(),
                  publicIp: editPublicIp.trim() || undefined,
                },
              });
            }}
            className="space-y-4 py-1"
          >
            {generalError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                {generalError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Node Hostname / Name</label>
              <Input
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  clearFieldError('name');
                }}
                placeholder="e.g. tako-worker-01"
                error={!!fieldErrors.name}
                className="h-8 text-xs font-sans"
              />
              <FieldError error={fieldErrors.name} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Private IP (Internal LAN)</label>
                <span className="text-[10px] text-muted-foreground">e.g. eth0 interface</span>
              </div>
              <Input
                value={editPrivateIp}
                onChange={(e) => {
                  setEditPrivateIp(e.target.value);
                  clearFieldError('ipAddress');
                  clearFieldError('privateIp');
                }}
                placeholder="e.g. 10.3.19.31 or 192.168.1.10"
                error={!!(fieldErrors.ipAddress || fieldErrors.privateIp)}
                className="h-8 text-xs font-mono"
              />
              <FieldError error={fieldErrors.ipAddress || fieldErrors.privateIp} />
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
                onChange={(e) => {
                  setEditPublicIp(e.target.value);
                  clearFieldError('publicIp');
                }}
                placeholder="e.g. 43.156.243.241"
                error={!!fieldErrors.publicIp}
                className="h-8 text-xs font-mono"
              />
              <FieldError error={fieldErrors.publicIp} />
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
                className="text-sm h-9 active:not-aria-[haspopup]:translate-y-px"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateMutation.isPending}
                className="text-sm h-9 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
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
              className="text-sm h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={rebootMutation.isPending}
              onClick={() => rebootMutation.mutate(node.id)}
              className="text-sm h-9 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
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
