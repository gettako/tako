'use client';

import React from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Deployment } from '@/lib/types';

export interface RollbackDialogProps {
  open: boolean;
  deployment: Deployment | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deploymentId: string) => void;
  isRollingBack?: boolean;
}

export function RollbackDialog({
  open,
  deployment,
  onOpenChange,
  onConfirm,
  isRollingBack = false,
}: RollbackDialogProps) {
  if (!deployment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">
            Rollback Deployment
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to revert your running service workload to this previous release?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Target Release</span>
            <span className="font-mono font-semibold text-foreground">
              {deployment.commitHash.substring(0, 7)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Branch</span>
            <span className="font-mono text-muted-foreground">{deployment.branch}</span>
          </div>
          <p className="text-xs text-foreground italic border-t border-border pt-2 line-clamp-2">
            "{deployment.commitMessage}"
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
          <span>
            This will redeploy the selected container image and re-run health checks. Active connections will be gracefully transferred.
          </span>
        </div>

        <DialogFooter className="pt-2 gap-2 sm:gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isRollingBack}
            onClick={() => onConfirm(deployment.id)}
            className="text-xs h-9 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
          >
            <RotateCcw className="size-3.5" />
            <span>{isRollingBack ? 'Initiating Rollback...' : 'Confirm Rollback'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
