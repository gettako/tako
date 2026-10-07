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
  Plus,
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

  // --- DATABASE NETWORKING ---
  if (service.type === 'database') {
    const port = service.ports[0] || (service.databaseType === 'redis' ? 6379 : 5432);
    const internalHost = `${service.name}.${service.nodeName}.internal`;

    return (
      <Card className="p-6 flex flex-col justify-between">
        <div>
          <CardHeader className="px-0 pt-0 pb-4">
            <SectionHeader
              icon={Database}
              title="Database Networking & Mesh"
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
                <div className="flex items-center gap-2">
                  <span className="font-mono text-foreground font-semibold">{internalHost}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(internalHost, 'Internal Hostname')}
                    className="text-muted-foreground hover:text-foreground"
                    title="Copy hostname"
                  >
                    {copiedUrl === internalHost ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
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

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Public Exposure</span>
                <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                  Disabled (Internal Only)
                </span>
              </div>
            </div>
          </CardContent>
        </div>

        <div className="pt-3 mt-3 border-t border-border/60 text-xs text-muted-foreground">
          <span>Accessible by other services running inside the same cluster network</span>
        </div>
      </Card>
    );
  }

  // --- APP / COMPOSE NETWORKING ---
  const customDomains = service.domains || [];
  const internalMeshDns = `${service.name}:${service.ports[0] || 80}`;

  return (
    <Card className="p-6 flex flex-col justify-between">
      <div>
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Globe}
            title="Domains & Ingress Routing"
            description="Edge routing, custom domain SSL certificates, and internal cluster DNS"
            action={
              onManageDomains ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onManageDomains}
                  className="h-7 text-xs gap-1 border-border hover:bg-muted text-foreground"
                >
                  <Plus className="size-3" />
                  <span>Add Domain</span>
                </Button>
              ) : undefined
            }
          />
        </CardHeader>

        <CardContent className="p-0 space-y-3">
          {/* Custom Domains List */}
          {customDomains.length > 0 ? (
            <div className="space-y-2">
              {customDomains.map((d) => (
                <div
                  key={d.id || d.domain}
                  className="rounded-lg border border-border bg-background p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-foreground truncate">
                        https://{d.domain}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                        <ShieldCheck className="size-3 text-emerald-500" />
                        TLS
                      </span>
                      {d.primary && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.2 font-mono text-[10px] text-primary font-medium">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Ingress Edge Host
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(`https://${d.domain}`, 'Custom domain')}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="Copy domain"
                    >
                      {copiedUrl === `https://${d.domain}` ? (
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
                          href={`https://${d.domain}`}
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
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/10 p-3.5 text-center space-y-1.5">
              <p className="text-xs text-muted-foreground">
                No custom domains attached yet.
              </p>
              {onManageDomains && (
                <button
                  type="button"
                  onClick={onManageDomains}
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>Connect a custom domain with free automated SSL</span>
                  <ArrowRight className="size-3" />
                </button>
              )}
            </div>
          )}

          {/* Internal Cluster Service Discovery DNS */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-muted/20 border border-border/50 text-xs">
            <div className="space-y-0.5">
              <span className="flex items-center gap-1.5 text-foreground font-medium text-xs">
                <Network className="size-3.5 text-primary" />
                Internal Cluster DNS
              </span>
              <p className="text-[11px] text-muted-foreground font-mono">
                For service-to-service communication
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-foreground font-semibold text-xs">
                http://{internalMeshDns}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(`http://${internalMeshDns}`, 'Internal DNS')}
                className="text-muted-foreground hover:text-foreground"
                title="Copy internal DNS"
              >
                {copiedUrl === `http://${internalMeshDns}` ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
          </div>

          {/* Traefik Edge Reverse Proxy details */}
          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-background border border-border/40 text-xs">
            <span className="text-muted-foreground">Traefik Edge Ingress</span>
            <span className="font-mono text-foreground text-[11px]">
              Port {service.ports.length > 0 ? service.ports.join(', ') : '80/3000'} &rarr; Edge HTTP/HTTPS
            </span>
          </div>
        </CardContent>
      </div>

      {onManageDomains && (
        <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span>Manage domain SSL certificates & redirects</span>
          <button
            type="button"
            onClick={onManageDomains}
            className="text-foreground hover:underline font-medium inline-flex items-center gap-1 shrink-0 ml-2"
          >
            <span>Domains Console</span>
            <ArrowRight className="size-3" />
          </button>
        </div>
      )}
    </Card>
  );
}
