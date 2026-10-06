'use client';

import React, { useState } from 'react';
import { AuditLog } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AuditDetailDrawer } from './audit-detail-drawer';
import { FileJson, ChevronLeft, ChevronRight, Clock, ShieldCheck } from 'lucide-react';

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface AuditTableProps {
  logs: AuditLog[];
  pageSize?: number;
}

export function AuditTable({ logs, pageSize = 10 }: AuditTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const totalPages = Math.ceil(logs.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleLogs = logs.slice(startIndex, startIndex + pageSize);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getTargetBadgeColor = (type: string) => {
    switch (type) {
      case 'service':
        return 'border-primary/40 bg-primary/10 text-primary';
      case 'node':
        return 'border-status-info/40 bg-status-info/10 text-status-info';
      case 'project':
        return 'border-status-success/40 bg-status-success/10 text-status-success';
      case 'user':
        return 'border-status-warning/40 bg-status-warning/10 text-status-warning';
      default:
        return 'border-border bg-muted/40 text-muted-foreground';
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40 border-b border-border">
            <TableRow className="h-10 hover:bg-transparent">
              <TableHead className="w-[18%]">Timestamp</TableHead>
              <TableHead className="w-[22%]">Actor</TableHead>
              <TableHead className="w-[18%]">Action</TableHead>
              <TableHead className="w-[20%]">Target Resource</TableHead>
              <TableHead className="w-[12%]">Source IP</TableHead>
              <TableHead className="text-right w-[10%]">Details</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-border/40">
            {visibleLogs.map((log) => (
              <TableRow
                key={log.id}
                className="h-14 hover:bg-muted/30 transition-colors group cursor-pointer"
                onClick={() => setSelectedLog(log)}
              >
                {/* 1. Timestamp */}
                <TableCell className="font-mono text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                  <div className="text-[10px] text-muted-foreground/80">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </div>
                </TableCell>

                {/* 2. Actor */}
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-7 text-[10px] border border-border shrink-0">
                      <AvatarImage src={log.actor.avatarUrl} alt={log.actor.name} />
                      <AvatarFallback>{getInitials(log.actor.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {log.actor.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {log.actor.email}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* 3. Action */}
                <TableCell>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted/60 text-foreground border border-border">
                    {log.action}
                  </span>
                </TableCell>

                {/* 4. Target Resource */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono capitalize ${getTargetBadgeColor(
                        log.targetType
                      )}`}
                    >
                      {log.targetType}
                    </Badge>
                    <span className="font-medium text-sm text-foreground truncate max-w-[160px]">
                      {log.targetName}
                    </span>
                  </div>
                </TableCell>

                {/* 5. Source IP */}
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {log.ipAddress}
                </TableCell>

                {/* 6. Action */}
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLog(log);
                    }}
                    className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-primary group-hover:text-primary active:not-aria-[haspopup]:translate-y-px"
                  >
                    <FileJson className="size-3.5" />
                    <span>Inspect</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground font-mono">
          <div>
            Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{' '}
            <span className="font-semibold text-foreground">
              {Math.min(startIndex + pageSize, logs.length)}
            </span>{' '}
            of <span className="font-semibold text-foreground">{logs.length}</span> events
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="size-8 p-0 border-border bg-card active:not-aria-[haspopup]:translate-y-px"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2 text-xs font-mono font-medium text-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="size-8 p-0 border-border bg-card active:not-aria-[haspopup]:translate-y-px"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Inspect Event Sheet Drawer */}
      <AuditDetailDrawer
        open={!!selectedLog}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null);
        }}
        log={selectedLog}
      />
    </>
  );
}
