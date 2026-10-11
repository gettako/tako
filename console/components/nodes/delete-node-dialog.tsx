'use client';

import React from 'react';
import { Node } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteNode } from '@/lib/queries';
import { Loader2, Trash2, AlertTriangle, Server, Boxes } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

interface DeleteNodeDialogProps {
  node: Node | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteNodeDialog({
  node,
  open,
  onOpenChange,
  onSuccess,
}: DeleteNodeDialogProps) {
  const deleteMutation = useDeleteNode({
    onSuccess: () => {
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
  });

  if (!node) return null;

  const hasWorkloads = (node.servicesCount ?? 0) > 0;
  const isOffline = node.status === 'offline';

  const handleDelete = () => {
    // If node has workloads or is offline/deleted VPS, use force=true to cleanly purge
    deleteMutation.mutate({
      id: node.id,
      force: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-status-danger/15 text-status-danger shrink-0">
              <Trash2 className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-foreground">Delete Cluster Node</DialogTitle>
              <DialogDescription>
                Permanently unregister and remove this node from Takō Cloud.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Node Summary Card */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="size-3.5 text-muted-foreground" />
                <span className="font-semibold text-foreground text-sm">{node.name}</span>
              </div>
              <StatusBadge status={node.status} size="sm" />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <span>IP: {node.ipAddress}</span>
              {node.publicIp && <span>WAN: {node.publicIp}</span>}
              <span className="flex items-center gap-1">
                <Boxes className="size-3" />
                <span>{node.servicesCount ?? 0} workloads</span>
              </span>
            </div>
          </div>

          {/* Workload / Offline VPS Warning Banner */}
          {hasWorkloads ? (
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 p-3 space-y-1.5 text-status-danger">
              <div className="flex items-center gap-2 font-semibold text-xs">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Active Workloads Detected ({node.servicesCount})</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                This node currently has <strong>{node.servicesCount} workload(s)</strong> assigned to it.
                {isOffline
                  ? ' Since this VPS was deleted or is offline, deleting this node will clean up its orphaned workload records.'
                  : ' Removing this node will cascade and delete its hosted service definitions.'}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Are you sure you want to remove <strong>{node.name}</strong> from your cluster? This action cannot be undone.
            </p>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            id="confirm-delete-node-btn"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="gap-1.5"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            <span>{deleteMutation.isPending ? 'Deleting...' : 'Delete Node'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
