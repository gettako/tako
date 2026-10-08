'use client';

import React from 'react';
import { Globe, ShieldCheck, ExternalLink, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServiceDomain } from '@/lib/types';

export interface DomainListProps {
  domains: ServiceDomain[];
  nodeIp?: string;
  onRemoveDomain: (id: string) => void;
  onSetPrimary: (id: string) => void;
}

export function DomainList({
  domains,
  nodeIp = '192.168.1.10',
  onRemoveDomain,
  onSetPrimary,
}: DomainListProps) {
  return (
    <div className="space-y-4">
      <div className="divide-y divide-border/60 rounded-lg border border-border bg-card overflow-hidden">
        {domains.map((dom) => (
          <div
            key={dom.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <a
                  href={`https://${dom.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-sm text-foreground hover:underline flex items-center gap-1.5"
                >
                  <span>{dom.domain}</span>
                  <ExternalLink className="size-3 text-muted-foreground" />
                </a>

                {dom.primary && (
                  <span className="rounded-xs bg-primary/10 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-primary uppercase">
                    Primary
                  </span>
                )}

                <span className="rounded-xs border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Port: {dom.port || 3000}
                </span>

                <span className="rounded-xs border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Path: {dom.path || '/'}
                </span>

                {dom.internalPath && dom.internalPath !== '/' && (
                  <span className="rounded-xs border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    Internal: {dom.internalPath}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                <span>DNS: Point A record to {nodeIp}</span>
                <span>•</span>
                {dom.ssl !== false ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="size-3" />
                    SSL Active (Let's Encrypt)
                  </span>
                ) : (
                  <span className="text-amber-500">
                    HTTP Only (SSL Disabled)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {!dom.primary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSetPrimary(dom.id)}
                  className="text-xs h-8"
                >
                  Set as Primary
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveDomain(dom.id)}
                className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Remove domain"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
