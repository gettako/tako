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
    <Link href={`/services/${service.id}`} className="block group outline-none h-full">
      <StatusAccentCard
        status={service.status}
        className="flex flex-col justify-between p-5 h-full transition-all group-hover:border-primary/40 group-hover:shadow-xs"
      >
        <div className="space-y-3.5">
          {/* Header row: Name, Type Badge, Domain & Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-foreground group-hover:text-primary transition-colors tracking-tight line-clamp-1">
                {service.name}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
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

                {/* Domain / Endpoint / Branch metadata */}
                {primaryDomain ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground truncate font-mono">
                    <Globe className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{primaryDomain.domain}</span>
                  </span>
                ) : service.connectionString ? (
                  <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground truncate">
                    <Database className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{service.connectionString}</span>
                  </span>
                ) : service.commitHash ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    <GitCommit className="size-3 text-muted-foreground shrink-0" />
                    <span className="font-mono text-[11px]">{service.commitHash}</span>
                    <span>• {service.branch}</span>
                  </span>
                ) : null}
              </div>
            </div>
            <StatusBadge status={service.status} size="sm" />
          </div>

          {/* Resource meters (side-by-side CPU & RAM) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
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

        {/* Clean Single-Row Footer */}
        <div className="mt-4 pt-3 flex items-center justify-between border-t border-border/50 text-xs text-muted-foreground">
          <span className="font-mono text-xs">
            {service.replicas} {service.replicas === 1 ? 'instance' : 'instances'}
          </span>
          <span className="font-mono text-xs flex items-center gap-1.5">
            <Server className="size-3 text-muted-foreground" />
            <span>{service.nodeName}</span>
          </span>
        </div>
      </StatusAccentCard>
    </Link>
  );
}
