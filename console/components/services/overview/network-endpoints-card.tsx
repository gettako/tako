'use client';

import React, { useState } from 'react';
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Network,
  ArrowRight,
  Database,
  Lock,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { Service, Deployment } from '@/lib/types';
import { toast } from 'sonner';

export interface NetworkEndpointsCardProps {
  service: Service;
  latestDeployment?: Deployment | null;
  onManageDomains?: () => void;
}

export function NetworkEndpointsCard({
  service,
  latestDeployment,
  onManageDomains,
}: NetworkEndpointsCardProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopy = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (service.type === 'database') {
    const port = service.ports[0] || (service.databaseType === 'redis' ? 6379 : 5432);
    const internalHost = `${service.name}.${service.nodeName}.internal`;

    return (
      <Card className="p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Database}
            title="Database Networking & Ports"
            description="Private cluster network bindings and secure communication port"
          />
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Network className="size-3.5 text-muted-foreground" />
                Internal Hostname
              </span>
              <span className="font-mono text-foreground font-semibold">{internalHost}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Lock className="size-3.5 text-muted-foreground" />
                Port Binding
              </span>
              <span className="font-mono text-foreground">{port} / TCP</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
              <span className="text-muted-foreground">Network Isolation</span>
              <span className="text-muted-foreground font-mono">Encrypted VPC Overlay</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const primaryDomain = service.domains.find((d) => d.primary) || service.domains[0];
  const commitHashPrefix = (
    latestDeployment?.commitHash ||
    service.commitHash ||
    'preview'
  )
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  const previewUrl =
    latestDeployment?.previewUrl || `http://${commitHashPrefix}-127-0-0-1.sslip.io`;

  return (
    <Card className="p-6 flex flex-col justify-between">
      <div>
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Globe}
            title="Domains & Endpoints"
            description="Public ingress routing, automatic preview domains, and edge proxy"
            action={
              onManageDomains ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onManageDomains}
                  className="h-7 text-xs gap-1 border-border hover:bg-muted text-foreground"
                >
                  <span>Manage</span>
                  <ArrowRight className="size-3" />
                </Button>
              ) : undefined
            }
          />
        </CardHeader>

        <CardContent className="p-0 space-y-3">
          {/* Primary Production Domain (if configured) */}
          {primaryDomain ? (
            <div className="rounded-lg border border-border bg-background p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs text-foreground truncate">
                    https://{primaryDomain.domain}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                    <ShieldCheck className="size-3 text-emerald-500" />
                    TLS
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                    Production
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  Primary Routing Ingress
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleCopy(`https://${primaryDomain.domain}`, 'Production domain')
                  }
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Copy domain"
                >
                  {copiedUrl === `https://${primaryDomain.domain}` ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a
                      href={`https://${primaryDomain.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                  className="h-7 px-2.5 text-xs gap-1 border-border hover:bg-muted text-foreground"
                >
                  <span>Visit</span>
                  <ExternalLink className="size-3" />
                </Button>
              </div>
            </div>
          ) : null}

          {/* Automatic Preview Domain (sslip.io) */}
          <div className="rounded-lg border border-border bg-background p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-foreground truncate">
                  {previewUrl}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                  sslip.io
                </span>
                <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                  Preview
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                Automatic git deployment routing
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(previewUrl, 'Preview URL')}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title="Copy preview URL"
              >
                {copiedUrl === previewUrl ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
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
                className="h-7 px-2.5 text-xs gap-1 border-border hover:bg-muted text-foreground"
              >
                <span>Visit</span>
                <ExternalLink className="size-3" />
              </Button>
            </div>
          </div>

          {/* Reverse Proxy & Port mapping info */}
          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/20 border border-border/40 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <Network className="size-3.5 text-muted-foreground" />
              Traefik Reverse Proxy
            </span>
            <span className="font-mono text-foreground text-[11px]">
              Port: {service.ports.length > 0 ? service.ports.join(', ') : '80/3000'} &rarr; Edge HTTP
            </span>
          </div>
        </CardContent>
      </div>

      {!primaryDomain && onManageDomains && (
        <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span>Attach your custom domain with free automatic SSL</span>
          <button
            onClick={onManageDomains}
            className="text-foreground hover:underline font-medium inline-flex items-center gap-1 shrink-0 ml-2"
          >
            <span>Add Domain</span>
            <ArrowRight className="size-3" />
          </button>
        </div>
      )}
    </Card>
  );
}
