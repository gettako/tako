'use client';

import React, { useState } from 'react';
import { AuditLog } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AuditDetailDrawer } from './audit-detail-drawer';
import { FileJson, ChevronLeft, ChevronRight, Clock, ShieldCheck } from 'lucide-react';

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
        return 'border-blue-500/40 bg-blue-500/10 text-blue-500';
      case 'project':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500';
      case 'user':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-500';
      default:
        return 'border-border/60 bg-muted/40 text-muted-foreground';
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/60 text-[11px] font-semibold text-muted-foreground">
              <tr className="h-11">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Target Resource</th>
                <th className="py-2.5 px-4">Source IP</th>
                <th className="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {visibleLogs.map((log) => (
                <tr key={log.id} className="h-14 hover:bg-muted/30 transition-colors">
                  {/* Timestamp */}
                  <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                    <div>
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </div>
                  </td>

                  {/* Actor */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-6 text-[10px]">
                        <AvatarImage src={log.actor.avatarUrl} alt={log.actor.name} />
                        <AvatarFallback>{getInitials(log.actor.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-foreground">{log.actor.name}</div>
                        <div className="text-[10px] text-muted-foreground">{log.actor.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Action Verb */}
                  <td className="py-3 px-4">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border/40">
                      {log.action}
                    </span>
                  </td>

                  {/* Target Resource */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono capitalize ${getTargetBadgeColor(
                          log.targetType
                        )}`}
                      >
                        {log.targetType}
                      </Badge>
                      <span className="font-medium text-foreground truncate max-w-xs">
                        {log.targetName}
                      </span>
                    </div>
                  </td>

                  {/* IP Address */}
                  <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                    {log.ipAddress}
                  </td>

                  {/* Inspect Details Button */}
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                      className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <FileJson className="size-3.5" />
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-muted/20 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-mono font-medium text-foreground">{startIndex + 1}</span> to{' '}
            <span className="font-mono font-medium text-foreground">
              {Math.min(startIndex + pageSize, logs.length)}
            </span>{' '}
            of <span className="font-mono font-medium text-foreground">{logs.length}</span> events
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2 text-xs font-mono">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-7 w-7 p-0"
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
