'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Terminal,
  Copy,
  Check,
  Shield,
  CheckCircle2,
  Server,
  Cpu,
  Network,
  Loader2,
} from 'lucide-react';
import { createNode, createNodeEnrollToken } from '@/lib/api/nodes';
import { Node } from '@/lib/types';
import { toast } from 'sonner';

export interface CreateNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (node: Node) => void;
}

export function CreateNodeDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateNodeDialogProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string>('');

  React.useEffect(() => {
    if (open) {
      createNodeEnrollToken()
        .then((data) => {
          if (data?.token) setToken(data.token);
        })
        .catch(() => {});
    }
  }, [open]);

  const installCommand = token
    ? `curl -fsSL https://gettako.dev/install.sh | bash -s -- --agent --token ${token}`
    : 'curl -fsSL https://gettako.dev/install.sh | bash -s -- --agent';

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    toast.success('Agent install command copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Simulated node connection for demo testing in the web console
  const simulateJoinMutation = useMutation({
    mutationFn: () => createNode(),
    onSuccess: (newNode) => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      toast.success(`Worker node "${newNode.name}" connected and online!`);
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(newNode);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Simulation failed');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Strict No-Icon DialogHeader */}
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-sans">
            Add Cluster Node
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Run the one-line agent installer on your host machine. Hostname, IP address, hardware specs, and architecture are automatically detected, registering the node as a cluster worker.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Agent Install Command Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Terminal className="size-3.5 text-primary" />
                Run on your host machine:
              </span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-mono">
                  Root / Sudo Required
                </Badge>
                <Badge variant="secondary" className="text-[10px] font-mono font-medium">
                  Role: Worker
                </Badge>
              </div>
            </div>

            <div className="relative rounded-xl border border-border bg-[#0B0C14] p-3.5 sm:p-4 font-mono text-xs sm:text-sm text-slate-200">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all leading-relaxed pr-10">
                <code className="text-emerald-400 font-semibold">{installCommand}</code>
              </pre>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyCommand}
                className="absolute top-2.5 sm:top-3 right-2.5 sm:right-3 size-7 text-slate-400 hover:text-white hover:bg-white/10 active:not-aria-[haspopup]:translate-y-px cursor-pointer"
                title="Copy Command"
              >
                {copied ? (
                  <Check className="size-3.5 text-status-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span className="sr-only">Copy</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Executing this script installs the Takō agent daemon, inspects host resources, and connects to the cluster automatically.
            </p>
          </div>

          {/* Automatic Installer Capabilities */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Automatic Provisioning Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                  <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Cpu className="size-3.5" />
                  </div>
                  <span>Hardware & ABI</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Auto-detects architecture (x86_64 / ARM64), vCPU cores, memory, and disk capacity.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                  <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Network className="size-3.5" />
                  </div>
                  <span>Network Identity</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Auto-resolves hostname, private network IP, and public routing interface.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                  <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Server className="size-3.5" />
                  </div>
                  <span>Worker Node</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Enrolls as an active Worker node ready to schedule and run container services.
                </p>
              </div>
            </div>
          </div>

          {/* Node Prerequisites Checklist */}
          <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2 text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Shield className="size-3 text-primary" />
              Node Prerequisites
            </span>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-muted-foreground text-[11px]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-status-success shrink-0" />
                <span>Docker Engine 24.0+ installed and active</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-status-success shrink-0" />
                <span>TCP Ports 9443 (RPC) and 7946 open</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-status-success shrink-0" />
                <span>Minimum 1 vCPU and 1 GB available host RAM</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-status-success shrink-0" />
                <span>Linux kernel 5.15+ (cgroups v2 enabled)</span>
              </li>
            </ul>
          </div>

          {/* Waiting for Telemetry Indicator */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-status-success"></span>
              </span>
              <span>Waiting for agent telemetry handshake...</span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">Port 9443</span>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="order-2 sm:order-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => simulateJoinMutation.mutate()}
              disabled={simulateJoinMutation.isPending}
              className="text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer active:not-aria-[haspopup]:translate-y-px"
            >
              {simulateJoinMutation.isPending ? (
                <>
                  <Loader2 className="size-3 animate-spin mr-1.5" />
                  <span>Connecting...</span>
                </>
              ) : (
                <span>Simulate Node Connection</span>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2 order-1 sm:order-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs sm:text-sm h-9 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleCopyCommand}
              className="text-xs sm:text-sm h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer active:not-aria-[haspopup]:translate-y-px gap-1.5"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              <span>{copied ? 'Command Copied' : 'Copy Script'}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export as RegisterNodeDialog for backwards compatibility
export { CreateNodeDialog as RegisterNodeDialog };
