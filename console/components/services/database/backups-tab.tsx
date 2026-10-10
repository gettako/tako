'use client';

import React, { useState } from 'react';
import { Archive, Plus, RotateCcw, CheckCircle2, Trash2, Database, Loader2 } from 'lucide-react';
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
import { Service, BackupItem } from '@/lib/types';
import {
  useServiceBackups,
  useCreateServiceBackup,
  useDeleteServiceBackup,
  useRestoreServiceBackup,
} from '@/lib/queries';
import { ConfirmDestructiveDialog } from '@/components/ui/confirm-destructive-dialog';

export type { BackupItem };

export interface BackupsTabProps {
  service: Service;
}

export function BackupsTab({ service }: BackupsTabProps) {
  const [backupToDelete, setBackupToDelete] = useState<BackupItem | null>(null);

  const { data: backups = [] } = useServiceBackups(service.id, service.slug);
  const createMutation = useCreateServiceBackup(service.id, service.slug);
  const restoreMutation = useRestoreServiceBackup(service.id);
  const deleteMutation = useDeleteServiceBackup(service.id, service.slug, {
    onSuccess: () => setBackupToDelete(null),
  });

  const handleCreateBackup = () => {
    createMutation.mutate();
  };

  const handleRestore = (name: string) => {
    restoreMutation.mutate(name);
  };

  const isCreating = createMutation.isPending;

  return (
    <div className="space-y-6">
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
            {isCreating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
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
                      disabled={restoreMutation.isPending}
                      className="gap-1 text-xs h-7 text-muted-foreground hover:text-foreground active:not-aria-[haspopup]:translate-y-px"
                    >
                      <RotateCcw className="size-3" />
                      <span className="hidden sm:inline">Restore</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setBackupToDelete(item)}
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

      {backupToDelete && (
        <ConfirmDestructiveDialog
          open={Boolean(backupToDelete)}
          onOpenChange={(open) => !open && setBackupToDelete(null)}
          title={`Delete Backup: ${backupToDelete.name}`}
          description="Are you sure you want to permanently delete this database backup snapshot from storage?"
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(backupToDelete.id)}
        />
      )}
    </div>
  );
}
