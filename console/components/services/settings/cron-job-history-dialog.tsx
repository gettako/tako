'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CronJob } from '@/lib/types';
import { getCronJobRuns } from '@/lib/api/crons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Clock, CheckCircle2, XCircle, Terminal, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

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
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const {
    data: runs = [],
    isLoading,
  } = useQuery({
    queryKey: ['cron-runs', job?.id],
    queryFn: () => (job ? getCronJobRuns(job.id) : Promise.resolve([])),
    enabled: !!job && open,
  });

  const handleCopyOutput = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Execution log copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-lg font-semibold">
            Execution History: {job?.name}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-mono mt-1">
            Command: {job?.command} • Schedule: {job?.schedule}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1">
          {isLoading ? (
            <LoadingSkeleton variant="cards" />
          ) : runs.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-lg">
              <Clock className="size-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No recorded executions for this job yet.</p>
            </div>
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
                        variant="outline"
                        className={isSuccess ? 'bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs' : 'bg-status-danger/10 text-status-danger border-status-danger/30 font-mono text-xs'}
                      >
                        Exit code: {run.exitCode}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyOutput(run.id, run.output)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Copy logs"
                      >
                        {copiedId === run.id ? (
                          <Check className="size-3.5 text-status-success" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Terminal Log Output */}
                  <div className="p-3 bg-[#0B0C14] font-mono text-sm text-[#939DB8] overflow-x-auto whitespace-pre leading-relaxed border-t border-border">
                    {run.output}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
