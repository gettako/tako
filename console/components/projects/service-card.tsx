'use client';

import React from 'react';
import Link from 'next/link';
import {
  Globe,
  Server,
  GitCommit,
  Database,
  Box,
  Layers,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { StatusAccentCard } from '@/components/ui/status-accent-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ResourceBar } from '@/components/ui/resource-bar';
import { Service } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface ServiceCardProps {
  service: Service;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const primaryDomain = service.domains.find((d) => d.primary) || service.domains[0];

  const getTypeIcon = (type: Service['type']) => {
    switch (type) {
      case 'database':
        return Database;
      case 'compose':
        return Box;
      default:
        return Layers;
    }
  };

  const TypeIcon = getTypeIcon(service.type);

  return (
    <StatusAccentCard
      status={service.status}
      className="group flex flex-col justify-between p-5 sm:p-6"
    >
      <div className="space-y-3">
        {/* Header row: Name, Type Badge, Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <Link
              href={`/services/${service.id}`}
              className="text-base sm:text-lg font-semibold text-foreground hover:text-primary transition-colors tracking-tight line-clamp-1"
            >
              {service.name}
            </Link>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-[10px] font-semibold uppercase font-mono tracking-wider',
                  service.type === 'database'
                    ? 'border border-status-success/20 bg-status-success/10 text-status-success'
                    : 'border border-primary/20 bg-primary/10 text-primary'
                )}
              >
                <TypeIcon className="size-2.5" />
                <span>{service.databaseType || service.type}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                <Server className="size-3" />
                {service.nodeName}
              </span>
            </div>
          </div>
          <StatusBadge status={service.status} size="sm" />
        </div>

        {/* Primary Domain / Endpoint */}
        {primaryDomain ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="size-3.5 text-muted-foreground shrink-0" />
            <a
              href={`https://${primaryDomain.domain}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary hover:underline transition-colors truncate"
            >
              {primaryDomain.domain}
            </a>
            <ExternalLink className="size-2.5 shrink-0 opacity-60" />
          </div>
        ) : service.connectionString ? (
          <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground truncate">
            <Database className="size-3.5 shrink-0" />
            <span className="truncate">{service.connectionString}</span>
          </div>
        ) : null}

        {/* Commit / Branch info */}
        {service.commitHash && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] border border-border/50">
              <GitCommit className="size-2.5" />
              {service.commitHash}
            </span>
            <span className="truncate font-sans">on {service.branch}</span>
          </div>
        )}

        {/* Resource meters (side-by-side CPU & RAM) */}
        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-border/50">
          <ResourceBar
            label="CPU"
            value={service.usage.cpuPercent}
            unit="%"
            size="sm"
          />
          <ResourceBar
            label="RAM"
            value={service.usage.memoryUsedMb}
            max={service.limits.memoryMb}
            unit="MB"
            size="sm"
          />
        </div>
      </div>

      {/* Footer info: Replicas & Manage link */}
      <div className="mt-4 pt-3 flex items-center justify-between border-t border-border/50 text-xs">
        <span className="text-muted-foreground font-mono text-xs">
          {service.replicas} {service.replicas === 1 ? 'instance' : 'instances'}
        </span>
        <Link
          href={`/services/${service.id}`}
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-xs"
        >
          <span>Configure</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </StatusAccentCard>
  );
}
