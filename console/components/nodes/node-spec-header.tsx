'use client';

import React, { useState } from 'react';
import { Node } from '@/lib/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Copy,
  Check,
  Clock,
  RotateCw,
  Terminal,
  Cpu,
  Layers,
  HardDrive,
  Activity,
  Server,
} from 'lucide-react';
import { toast } from 'sonner';

interface NodeSpecHeaderProps {
  node: Node;
  onRefresh?: () => void;
}

export function NodeSpecHeader({ node, onRefresh }: NodeSpecHeaderProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${field} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRefreshClick = () => {
    if (onRefresh) {
      setIsRefreshing(true);
      onRefresh();
      toast.success('Refreshing node telemetry');
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  const sshCommand = `ssh -p 22 admin@${node.ipAddress}`;

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
            onClick={() => setTerminalOpen(true)}
            className="text-xs gap-1.5 h-9 active:not-aria-[haspopup]:translate-y-px"
          >
            <Terminal className="size-3.5" />
            <span>Connect SSH</span>
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
        </div>
      </div>

      {/* 3. Hardware & Network Telemetry Grid */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6 text-xs">
          {/* Private IP */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium">Private IP</span>
            <div className="flex items-center gap-1.5 font-mono text-foreground font-medium text-xs">
              <span>{node.ipAddress}</span>
              <button
                type="button"
                onClick={() => handleCopy('Private IP', node.ipAddress)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors active:not-aria-[haspopup]:translate-y-px"
                title="Copy Private IP"
                aria-label="Copy Private IP"
              >
                {copiedField === 'Private IP' ? (
                  <Check className="size-3 text-status-success" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
          </div>

          {/* Public IP */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium">Public IP</span>
            <div className="flex items-center gap-1.5 font-mono text-foreground font-medium text-xs">
              <span>{node.publicIp || 'None'}</span>
              {node.publicIp && (
                <button
                  type="button"
                  onClick={() => handleCopy('Public IP', node.publicIp!)}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors active:not-aria-[haspopup]:translate-y-px"
                  title="Copy Public IP"
                  aria-label="Copy Public IP"
                >
                  {copiedField === 'Public IP' ? (
                    <Check className="size-3 text-status-success" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
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
              {Math.round(node.memoryTotalMb / 1024)} GB host RAM
            </div>
          </div>

          {/* Persistent Disk */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <HardDrive className="size-3 text-status-warning" />
              Storage Volume
            </span>
            <div className="font-mono text-foreground font-medium text-xs">
              {node.diskTotalGb} GB NVMe/SSD
            </div>
          </div>

          {/* System Uptime */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Clock className="size-3" />
              System Uptime
            </span>
            <div className="font-medium text-foreground text-xs truncate" title={node.uptime}>
              {node.uptime}
            </div>
          </div>
        </div>
      </div>

      {/* SSH Connection Modal */}
      <Dialog open={terminalOpen} onOpenChange={setTerminalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Connect to {node.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Establish a secure SSH session into this cluster node.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="relative rounded-xl border border-border bg-[#0B0C14] p-3.5 font-mono text-xs text-slate-200">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all pr-8">
                <code>{sshCommand}</code>
              </pre>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  navigator.clipboard.writeText(sshCommand);
                  toast.success('SSH command copied to clipboard');
                }}
                className="absolute top-2.5 right-2.5 size-7 text-slate-400 hover:text-white hover:bg-white/10 active:not-aria-[haspopup]:translate-y-px"
                title="Copy Command"
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Make sure your public SSH key is authorized in <code>/root/.ssh/authorized_keys</code> on this host.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTerminalOpen(false)}
              className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
