'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Service, CronJob, CreateCronJobInput } from '@/lib/types';
import {
  getCronJobs,
  createCronJob,
  updateCronJob,
  toggleCronJobStatus,
  runCronJobNow,
  deleteCronJob,
} from '@/lib/api/crons';
import { explainCronExpression } from '@/lib/utils/cron-explainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { SectionHeader } from '@/components/ui/section-header';
import { CronJobDialog } from './cron-job-dialog';
import { CronJobHistoryDialog } from './cron-job-history-dialog';
import {
  Clock,
  Play,
  History,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';

interface CronJobsSectionProps {
  service: Service;
}

export function CronJobsSection({ service }: CronJobsSectionProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [historyJob, setHistoryJob] = useState<CronJob | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);

  const {
    data: jobs = [],
    isLoading,
  } = useQuery({
    queryKey: ['cron-jobs', service.id],
    queryFn: () => getCronJobs(service.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cron-jobs', service.id] });
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateCronJobInput) =>
      editingJob ? updateCronJob(editingJob.id, input) : createCronJob(input),
    onSuccess: () => {
      invalidate();
      toast.success(editingJob ? 'Cron job updated' : 'Cron job created successfully');
      setEditingJob(null);
    },
    onError: () => toast.error('Failed to save cron job'),
  });

  const toggleMutation = useMutation({
    mutationFn: toggleCronJobStatus,
    onSuccess: (updated) => {
      invalidate();
      toast.success(`Job is now ${updated.status}`);
    },
    onError: () => toast.error('Failed to update job status'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCronJob,
    onSuccess: () => {
      invalidate();
      toast.success('Cron job deleted');
    },
    onError: () => toast.error('Failed to delete cron job'),
  });

  const handleRunNow = async (job: CronJob) => {
    try {
      setRunningJobId(job.id);
      const run = await runCronJobNow(job.id);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['cron-runs', job.id] });
      toast.success(`Job "${job.name}" triggered (${run.durationMs}ms, exit code 0)`);
    } catch {
      toast.error('Failed to trigger cron job');
    } finally {
      setRunningJobId(null);
    }
  };

  const handleCopyCommand = (jobId: string, command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommandId(jobId);
    toast.success('Command copied to clipboard');
    setTimeout(() => setCopiedCommandId(null), 2000);
  };

  const formatRelativeTime = (iso?: string) => {
    if (!iso) return 'Never';
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Clock}
            title="Scheduled Auxiliary Jobs"
            description="Run background tasks, database cleanups, and batch jobs on fixed intervals inside this service."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditingJob(null);
                  setDialogOpen(true);
                }}
                className="gap-1.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium shrink-0"
              >
                <Plus className="size-3.5" />
                Add Cron Job
              </Button>
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2">
          {isLoading ? (
            <LoadingSkeleton variant="table" />
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No cron jobs configured"
              description="Schedule automated periodic tasks, cache warming, or cleanups inside your container."
              action={{
                label: 'Create your first cron job',
                onClick: () => {
                  setEditingJob(null);
                  setDialogOpen(true);
                },
                icon: Plus,
              }}
            />
          ) : (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-b border-border/60 hover:bg-transparent">
                    <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Name & Schedule
                    </TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Command
                    </TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Active
                    </TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Last Run
                    </TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Next Run
                    </TableHead>
                    <TableHead className="py-2.5 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const isRunning = runningJobId === job.id;
                    const isActive = job.status === 'active';
                    return (
                      <TableRow key={job.id} className="hover:bg-muted/30 border-b border-border/40">
                        {/* Name & Schedule */}
                        <TableCell className="py-3.5 px-4">
                          <div className="font-medium text-foreground text-sm">{job.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-sm text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {job.schedule}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              • {explainCronExpression(job.schedule)}
                            </span>
                          </div>
                        </TableCell>

                        {/* Command */}
                        <TableCell className="py-3.5 px-4 font-mono text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5 max-w-xs truncate bg-muted/40 px-2.5 py-1 rounded border border-border/40">
                            <Terminal className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{job.command}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleCopyCommand(job.id, job.command)}
                              className="text-muted-foreground hover:text-foreground shrink-0 ml-auto"
                              title="Copy command"
                            >
                              {copiedCommandId === job.id ? (
                                <Check className="size-3.5 text-status-success" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>

                        {/* Active Toggle Switch (AC-4) */}
                        <TableCell className="py-3.5 px-4">
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => toggleMutation.mutate(job.id)}
                            aria-label="Toggle active status"
                          />
                        </TableCell>

                        {/* Last Run */}
                        <TableCell className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {job.lastStatus === 'success' ? (
                              <CheckCircle2 className="size-3.5 text-status-success shrink-0" />
                            ) : job.lastStatus === 'failed' ? (
                              <XCircle className="size-3.5 text-status-danger shrink-0" />
                            ) : (
                              <span className="size-2 rounded-full bg-muted-foreground shrink-0" />
                            )}
                            <span className="text-muted-foreground text-sm">
                              {formatRelativeTime(job.lastRunAt)}
                            </span>
                          </div>
                        </TableCell>

                        {/* Next Run */}
                        <TableCell className="py-3.5 px-4 font-mono text-sm text-muted-foreground">
                          {isActive ? (
                            job.nextRunAt ? (
                              new Date(job.nextRunAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            ) : (
                              'Scheduled'
                            )
                          ) : (
                            <span className="text-muted-foreground/60 italic">Paused</span>
                          )}
                        </TableCell>

                        {/* Action Buttons (AC-6) */}
                        <TableCell className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Run Now Trigger */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRunNow(job)}
                              disabled={isRunning}
                              className="h-8 text-sm gap-1.5 text-primary hover:text-primary hover:bg-primary/10 border-primary/30"
                              title="Run this job immediately"
                            >
                              {isRunning ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Play className="size-3" />
                              )}
                              Run Now
                            </Button>

                            {/* History Modal Trigger */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setHistoryJob(job)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="View execution history"
                            >
                              <History className="size-4" />
                            </Button>

                            {/* Edit Job */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingJob(job);
                                setDialogOpen(true);
                              }}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="Edit job"
                            >
                              <Pencil className="size-4" />
                            </Button>

                            {/* Delete Job */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Delete cron job "${job.name}"?`)) {
                                  deleteMutation.mutate(job.id);
                                }
                              }}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-status-danger"
                              title="Delete job"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <CronJobDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingJob(null);
        }}
        serviceId={service.id}
        initialJob={editingJob}
        onSave={async (input) => {
          await createMutation.mutateAsync(input);
        }}
      />

      {/* Execution History Dialog */}
      <CronJobHistoryDialog
        open={!!historyJob}
        onOpenChange={(open) => {
          if (!open) setHistoryJob(null);
        }}
        job={historyJob}
      />
    </div>
  );
}
