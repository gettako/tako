'use client';

import React, { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export interface AddDomainInput {
  domain: string;
  port: number;
  path: string;
  ssl: boolean;
}

export interface AddDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddDomain: (data: AddDomainInput) => void;
  defaultPort?: number;
}

export function AddDomainDialog({
  open,
  onOpenChange,
  onAddDomain,
  defaultPort = 3000,
}: AddDomainDialogProps) {
  const [domainInput, setDomainInput] = useState('');
  const [portInput, setPortInput] = useState(defaultPort.toString());
  const [pathInput, setPathInput] = useState('/');
  const [sslEnabled, setSslEnabled] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDomain = domainInput.trim().toLowerCase();
    const parsedPort = parseInt(portInput, 10);
    const trimmedPath = pathInput.trim() || '/';

    // Basic domain validation
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,10}$/;
    if (!domainRegex.test(trimmedDomain)) {
      setError('Please enter a valid domain format (e.g. app.yourdomain.com)');
      return;
    }

    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setError('Port must be a valid number between 1 and 65535');
      return;
    }

    onAddDomain({
      domain: trimmedDomain,
      port: parsedPort,
      path: trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`,
      ssl: sslEnabled,
    });

    setDomainInput('');
    setPortInput(defaultPort.toString());
    setPathInput('/');
    setSslEnabled(true);
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add Custom Domain</DialogTitle>
            <DialogDescription>
              Configure an external hostname, container routing port, and SSL certificate for this service.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            {/* Domain Name */}
            <div className="space-y-1.5">
              <label htmlFor="domain-input" className="text-xs font-medium text-foreground">
                Domain Name (Host)
              </label>
              <Input
                id="domain-input"
                type="text"
                placeholder="api.example.com"
                value={domainInput}
                onChange={(e) => {
                  setDomainInput(e.target.value);
                  if (error) setError('');
                }}
                className="font-mono text-xs h-9"
                autoFocus
                required
              />
            </div>

            {/* Target Container Port & Routing Path */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="port-input" className="text-xs font-medium text-foreground">
                  Container Port
                </label>
                <Input
                  id="port-input"
                  type="number"
                  placeholder="3000"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value)}
                  className="font-mono text-xs h-9"
                  min={1}
                  max={65535}
                  required
                />
                <p className="text-[10px] text-muted-foreground">Internal service port</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="path-input" className="text-xs font-medium text-foreground">
                  Path Prefix
                </label>
                <Input
                  id="path-input"
                  type="text"
                  placeholder="/"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  className="font-mono text-xs h-9"
                  required
                />
                <p className="text-[10px] text-muted-foreground">HTTP request path prefix</p>
              </div>
            </div>

            {/* SSL / HTTPS Option (Dokploy style) */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  <span>HTTPS / SSL Certificate</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Automatic Let's Encrypt TLS with auto-renewal
                </div>
              </div>
              <Switch
                checked={sslEnabled}
                onCheckedChange={setSslEnabled}
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              <span>Add Domain</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
