'use client';

import React from 'react';
import { CronJob } from '@/lib/types';
import { useCronJobRuns } from '@/lib/queries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { CopyButton } from '@/components/ui/copy-button';
import { Clock, CheckCircle2, XCircle, Terminal } from 'lucide-react';

interface CronJobHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: CronJob | null;
}

export function CronJobHistoryDialog({
  open,
  onOpenChange,
  job,
}: CronJobHistoryDialogProps) {
  const { data: runs = [], isLoading } = useCronJobRuns(open && job ? job.id : null);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-lg font-semibold">
            Execution History: {job?.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-mono">
            {job?.schedule} • Command: <span className="text-foreground">{job?.command}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1">
          {isLoading ? (
            <LoadingSkeleton variant="cards" />
          ) : runs.length === 0 ? (
            <EmptyState
              title="No recorded executions"
              description="No automated or manual run logs exist for this cron job yet."
              icon={Clock}
            />
          ) : (
            runs.map((run) => {
              const isSuccess = run.status === 'success';
              return (
                <div
                  key={run.id}
                  className="rounded-lg border border-border bg-card overflow-hidden text-sm"
                >
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      {isSuccess ? (
                        <CheckCircle2 className="size-4 text-status-success shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-status-danger shrink-0" />
                      )}
                      <span className="font-mono text-sm text-foreground font-medium">
                        {new Date(run.startedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Duration: <span className="font-mono">{formatDuration(run.durationMs)}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isSuccess ? 'secondary' : 'destructive'}
                        className="text-xs font-mono"
                      >
                        Exit code: {run.exitCode}
                      </Badge>
                      <CopyButton
                        value={run.output}
                        label="execution log"
                        className="size-7"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-muted/15 font-mono text-xs overflow-x-auto max-h-48 whitespace-pre text-foreground">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1 select-none text-[11px]">
                      <Terminal className="size-3" />
                      <span>Console Stdout / Stderr</span>
                    </div>
                    {run.output || '(No stdout produced)'}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-sm h-9 active:not-aria-[haspopup]:translate-y-px"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
