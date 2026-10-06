'use client';

import React from 'react';
import Link from 'next/link';
import { Globe, Server, Database, Box, Layers, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { TableRow, TableCell } from '@/components/ui/table';
import { Service } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface ServiceRowProps {
  service: Service;
}

export function ServiceRow({ service }: ServiceRowProps) {
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
    <TableRow
      className="group h-14 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => {
        window.location.href = `/services/${service.id}`;
      }}
    >
      {/* Service Name & Type */}
      <TableCell className="font-medium">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-md shrink-0',
              service.type === 'database'
                ? 'border border-status-success/20 bg-status-success/10 text-status-success'
                : 'border border-primary/20 bg-primary/10 text-primary'
            )}
          >
            <TypeIcon className="size-3.5" />
          </span>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-sm tracking-tight group-hover:text-primary transition-colors">
              {service.name}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              {service.databaseType || service.type}
            </span>
          </div>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        <StatusBadge status={service.status} size="sm" />
      </TableCell>

      {/* Node */}
      <TableCell className="hidden sm:table-cell">
        <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
          <Server className="size-3" />
          {service.nodeName}
        </span>
      </TableCell>

      {/* Domain / Endpoint */}
      <TableCell className="hidden md:table-cell">
        {primaryDomain ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 truncate max-w-[200px]">
            <Globe className="size-3 shrink-0" />
            <span className="truncate">{primaryDomain.domain}</span>
          </span>
        ) : service.connectionString ? (
          <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px] block">
            {service.connectionString}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">Internal only</span>
        )}
      </TableCell>

      {/* Resources & Replicas */}
      <TableCell className="hidden lg:table-cell text-xs font-mono text-muted-foreground">
        {service.usage.cpuPercent}% CPU • {service.usage.memoryUsedMb}MB RAM ({service.replicas}x)
      </TableCell>

      {/* Action */}
      <TableCell className="text-right">
        <Link
          href={`/services/${service.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors group-hover:text-primary active:not-aria-[haspopup]:translate-y-px"
        >
          <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
          <span className="sr-only">Configure service</span>
        </Link>
      </TableCell>
    </TableRow>
  );
}
