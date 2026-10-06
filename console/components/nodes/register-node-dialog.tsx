'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Terminal, Copy, Check, Shield, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface RegisterNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterNodeDialog({ open, onOpenChange }: RegisterNodeDialogProps) {
  const [copied, setCopied] = useState(false);
  const [selectedArch, setSelectedArch] = useState<'x86_64' | 'arm64'>('x86_64');

  const joinCommand = `curl -fsSL https://get.tako.cloud/join.sh | sudo sh -s -- \\
  --cluster 192.168.1.10:9443 \\
  --token tk_join_${Math.random().toString(36).substring(2, 10)}_live`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinCommand);
    setCopied(true);
    toast.success('Join command copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
            Register Cluster Node
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Join a bare-metal server, cloud VPS, or edge compute node to this Takō cluster.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Architecture Selector */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Host Architecture</span>
            <div className="flex items-center gap-1.5 p-1 rounded-lg border border-border/80 bg-muted/30">
              <button
                type="button"
                onClick={() => setSelectedArch('x86_64')}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
                  selectedArch === 'x86_64'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                x86_64 (AMD64)
              </button>
              <button
                type="button"
                onClick={() => setSelectedArch('arm64')}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
                  selectedArch === 'arm64'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                arm64 (Apple / Ampere)
              </button>
            </div>
          </div>

          {/* Installation Terminal Code Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                <Terminal className="size-3.5" />
                Run on your target host terminal:
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                Root / Sudo Required
              </Badge>
            </div>

            <div className="relative rounded-xl border border-border/70 bg-[#0B0C14] p-3.5 font-mono text-xs text-slate-200">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all leading-relaxed pr-8">
                <code>{joinCommand}</code>
              </pre>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopy}
                className="absolute top-2.5 right-2.5 size-7 text-slate-400 hover:text-white hover:bg-white/10 active:not-aria-[haspopup]:translate-y-px"
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
          </div>

          {/* Prerequisites Checklist */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-2 text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Shield className="size-3 text-primary" />
              Node Prerequisites
            </span>
            <ul className="space-y-1.5 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-status-success shrink-0" />
                <span>Docker Engine 24.0+ installed and running as a systemd service.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-status-success shrink-0" />
                <span>TCP Ports 9443 (orchestrator RPC) and 7946 (overlay network) reachable.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-status-success shrink-0" />
                <span>Minimum 1 vCPU and 1 GB available host RAM for agent telemetry.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs active:not-aria-[haspopup]:translate-y-px"
          >
            Close
          </Button>
          <Button
            size="sm"
            onClick={handleCopy}
            className="text-xs gap-1.5 active:not-aria-[haspopup]:translate-y-px"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            <span>Copy Join Script</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
