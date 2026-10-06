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
  ChevronRight,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
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
    <Link href={`/services/${service.id}`} className="block group outline-hidden h-[170px]">
      <Card
        size="sm"
        className="relative h-[170px] flex flex-col justify-between overflow-hidden transition-all duration-150 group-hover:border-foreground/40 active:not-aria-[haspopup]:translate-y-px py-0 gap-0"
      >
        <div className="p-4 pb-3 space-y-2.5">
          {/* Header row: Name, Type Badge, Domain & Status */}
          <CardHeader className="p-0">
            <div className="space-y-0.5 min-w-0 pr-2">
              <CardTitle className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors tracking-tight line-clamp-1">
                {service.name}
              </CardTitle>
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn( 'inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-[10px] font-semibold uppercase font-mono tracking-wider shrink-0', service.type === 'database' ? 'border border-status-success/20 bg-status-success/10 text-status-success' : 'border border-primary/20 bg-primary/10 text-primary' )}
                >
                  <TypeIcon className="size-2.5" />
                  <span>{service.databaseType || service.type}</span>
                </span>

                {/* Domain / Endpoint / Branch metadata */}
                {primaryDomain ? (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate font-mono">
                    <Globe className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{primaryDomain.domain}</span>
                  </span>
                ) : service.connectionString ? (
                  <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground truncate">
                    <Database className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{service.connectionString}</span>
                  </span>
                ) : service.commitHash ? (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                    <GitCommit className="size-3 text-muted-foreground shrink-0" />
                    <span className="font-mono">{service.commitHash}</span>
                    <span>• {service.branch}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <CardAction>
              <StatusBadge status={service.status} size="sm" />
            </CardAction>
          </CardHeader>

          {/* Resource meters (side-by-side CPU & RAM) */}
          <CardContent className="p-0">
            <div className="grid grid-cols-2 gap-2.5">
              <ResourceBar
                label="CPU"
                value={service.usage.cpuPercent}
                unit="%"
                size="sm"
                className="space-y-1"
              />
              <ResourceBar
                label="RAM"
                value={service.usage.memoryUsedMb}
                max={service.limits.memoryMb}
                unit="MB"
                size="sm"
                className="space-y-1"
              />
            </div>
          </CardContent>
        </div>

        {/* Clean Single-Row Footer */}
        <CardFooter className="px-4 py-2.5 flex items-center justify-between border-t border-border text-xs text-muted-foreground h-10 shrink-0">
          <span className="font-mono text-[11px] shrink-0">
            {service.replicas} {service.replicas === 1 ? 'instance' : 'instances'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-[11px] flex items-center gap-1.5 truncate">
              <Server className="size-3 text-muted-foreground shrink-0" />
              <span className="truncate">{service.nodeName}</span>
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
