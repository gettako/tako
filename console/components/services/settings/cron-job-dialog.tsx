'use client';

import React, { useState, useEffect } from 'react';
import { CronJob, CreateCronJobInput } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from 'cn';
import {
  validateCronExpression,
  explainCronExpression,
  getNextRunDates,
} from '@/lib/utils/cron-explainer';
import { Calendar, Clock, Terminal, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CronJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string;
  initialJob?: CronJob | null;
  onSave: (input: CreateCronJobInput) => Promise<void>;
}

export function CronJobDialog({
  open,
  onOpenChange,
  serviceId,
  initialJob,
  onSave,
}: CronJobDialogProps) {
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('0 3 * * *');
  const [command, setCommand] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialJob) {
      setName(initialJob.name);
      setSchedule(initialJob.schedule);
      setCommand(initialJob.command);
    } else {
      setName('');
      setSchedule('0 3 * * *');
      setCommand('');
    }
  }, [initialJob, open]);

  const validation = validateCronExpression(schedule);
  const explanation = explainCronExpression(schedule);
  const nextRuns = validation.isValid ? getNextRunDates(schedule, 5) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim() || !validation.isValid) return;

    try {
      setIsSaving(true);
      await onSave({
        serviceId,
        name: name.trim(),
        schedule: schedule.trim(),
        command: command.trim(),
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const PRESETS = [
    { label: 'Every 15 min', expr: '*/15 * * * *' },
    { label: 'Hourly', expr: '0 * * * *' },
    { label: 'Daily at 03:00', expr: '0 3 * * *' },
    { label: 'Weekly (Sun)', expr: '0 0 * * 0' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {initialJob ? 'Edit Cron Job' : 'Add Scheduled Cron Job'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Define scheduled commands that execute periodically inside this service container.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Job Name */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Job Name</Label>
              <Input
                placeholder="e.g. sitemap-regenerator"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSaving}
                className="font-mono text-sm"
              />
            </div>

            {/* Schedule Expression */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Clock className="size-4 text-primary" />
                  Schedule (5-field Cron Expression)
                </Label>
                <div className="flex gap-1.5 flex-wrap">
                  {PRESETS.map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSchedule(p.expr)}
                      disabled={isSaving}
                      className={cn( 'h-7 px-2 text-xs font-mono transition-colors', schedule === p.expr ? 'border-primary/50 bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground' )}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="*/15 * * * *"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  required
                  disabled={isSaving}
                  className="font-mono text-sm"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Preset template:</span>
                  <div className="flex-1">
                    <SearchableSelect
                      value={PRESETS.find((p) => p.expr === schedule)?.expr || ''}
                      onValueChange={(val) => val && setSchedule(val)}
                      options={PRESETS.map((p) => ({
                        value: p.expr,
                        label: `${p.label} (${p.expr})`,
                        description: explainCronExpression(p.expr),
                      }))}
                      placeholder="Choose schedule preset..."
                      searchPlaceholder="Search cron presets..."
                      size="sm"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Realtime Validation & Human Explanation */}
              <div className="rounded-md border p-3 text-sm transition-colors bg-muted/30">
                {validation.isValid ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-status-success font-medium text-sm">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>{explanation}</span>
                    </div>

                    {/* Next 5 runs preview (AC-5) */}
                    <div className="pt-2 border-t border-border space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        Next 5 Scheduled Executions (UTC)
                      </span>
                      <ul className="text-xs font-mono text-muted-foreground space-y-1">
                        {nextRuns.map((date, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="text-muted-foreground/60 w-3">{idx + 1}.</span>
                            <span>{date.toUTCString().replace(' GMT', ' UTC')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-status-danger text-sm">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{validation.error || 'Invalid cron expression format'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Execution Command */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Terminal className="size-4 text-muted-foreground" />
                Container Command
              </Label>
              <Input
                placeholder="npm run job:cleanup"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                required
                disabled={isSaving}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Command is invoked via <code>/bin/sh -c</code> inside the service workspace.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || !command.trim() || !validation.isValid || isSaving}
              className="text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {isSaving ? 'Saving...' : initialJob ? 'Update Job' : 'Create Job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
