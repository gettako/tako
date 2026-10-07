'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Plus, RotateCcw, CheckCircle2, Download, Trash2, Database } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Service } from '@/lib/types';
import {
  getServiceBackups,
  createServiceBackup,
  deleteServiceBackup,
  restoreServiceBackup,
  type BackupItem,
} from '@/lib/api/backups';

export type { BackupItem };

export interface BackupsTabProps {
  service: Service;
}

export function BackupsTab({ service }: BackupsTabProps) {
  const queryClient = useQueryClient();
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const { data: backups = [] } = useQuery({
    queryKey: ['service-backups', service.id],
    queryFn: () => getServiceBackups(service.id, service.slug),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['service-backups', service.id] });
  };

  const createMutation = useMutation({
    mutationFn: () => createServiceBackup(service.id, service.slug),
    onSuccess: () => {
      invalidate();
      setActionNotice('Database backup created and saved to S3 target.');
      setTimeout(() => setActionNotice(null), 3000);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (name: string) => restoreServiceBackup(service.id, name),
    onSuccess: (_, name) => {
      setActionNotice(`Restore initiated from ${name}...`);
      setTimeout(() => setActionNotice(null), 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteServiceBackup(service.id, id, service.slug),
    onSuccess: () => {
      invalidate();
    },
  });

  const handleCreateBackup = () => {
    createMutation.mutate();
  };

  const handleRestore = (name: string) => {
    if (confirm(`Are you sure you want to restore database from ${name}? Current state will be overwritten.`)) {
      restoreMutation.mutate(name);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const isCreating = createMutation.isPending;


  return (
    <div className="space-y-6">
      {actionNotice && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          <span>{actionNotice}</span>
        </div>
      )}

      <SectionHeader
        icon={Database}
        title="Database Snapshots & Backups"
        description="Automated scheduled dumps stored in configured S3-compatible cloud storage"
        action={
          <Button
            size="sm"
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="gap-1.5 text-xs h-9"
          >
            <Plus className="size-3.5" />
            <span>{isCreating ? 'Creating Snapshot...' : 'Create Backup Now'}</span>
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40 border-b border-border">
            <TableRow className="h-10 hover:bg-transparent">
              <TableHead>Snapshot Archive</TableHead>
              <TableHead className="w-[120px]">Size</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="hidden sm:table-cell">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {backups.map((item) => (
              <TableRow key={item.id} className="h-14 hover:bg-muted/30 transition-colors">
                <TableCell className="font-mono text-xs font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <Archive className="size-3.5 text-muted-foreground" />
                    <span>{item.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {item.sizeMb} MB
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 rounded-full border border-status-success/20 bg-status-success/10 px-2 py-0.5 text-[11px] font-medium text-status-success">
                    <CheckCircle2 className="size-3" />
                    Completed
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-xs font-mono text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(item.name)}
                      className="gap-1 text-xs h-7 text-muted-foreground hover:text-foreground active:not-aria-[haspopup]:translate-y-px"
                    >
                      <RotateCcw className="size-3" />
                      <span className="hidden sm:inline">Restore</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      className="size-7 text-muted-foreground hover:text-destructive active:not-aria-[haspopup]:translate-y-px"
                      title="Delete snapshot"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
