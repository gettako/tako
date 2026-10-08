'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBackupSchedule,
  updateBackupSchedule,
  triggerManualBackup,
  getS3Buckets,
} from '@/lib/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Database, CheckCircle2, Play, Save, Loader2, Clock } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

export function BackupsPanel() {
  const queryClient = useQueryClient();
  const [isTriggering, setIsTriggering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: schedule, isLoading: loadingSchedule } = useQuery({
    queryKey: ['backup-schedule'],
    queryFn: getBackupSchedule,
  });

  const { data: buckets = [] } = useQuery({
    queryKey: ['s3-buckets'],
    queryFn: getS3Buckets,
  });

  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(schedule?.frequency ?? 'daily');
  const [timeUtc, setTimeUtc] = useState(schedule?.timeUtc ?? '03:00');
  const [retentionDays, setRetentionDays] = useState(schedule?.retentionDays ?? 30);
  const [bucketId, setBucketId] = useState(schedule?.destinationBucketId ?? (buckets[0]?.id || ''));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateBackupSchedule({
        enabled,
        frequency,
        timeUtc,
        retentionDays,
        destinationBucketId: bucketId,
      });
      queryClient.invalidateQueries({ queryKey: ['backup-schedule'] });
      toast.success('Backup schedule configuration saved');
    } catch {
      toast.error('Failed to update backup schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackupNow = async () => {
    try {
      setIsTriggering(true);
      const res = await triggerManualBackup();
      queryClient.invalidateQueries({ queryKey: ['backup-schedule'] });
      toast.success(`Cluster snapshot generated (${res.snapshotSizeMb} MB, ${res.durationMs}ms)`);
    } catch {
      toast.error('Failed to create manual backup');
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Database}
            title="Tako Control Plane Backups"
            description="Automate scheduled cryptographic dumps of the internal Tako cluster state, service configs, and encrypted secrets."
            action={
              <Button
                type="button"
                size="default"
                onClick={handleBackupNow}
                disabled={isTriggering}
                className="text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 shrink-0 active:not-aria-[haspopup]:translate-y-px"
              >
                {isTriggering ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                Backup Now
              </Button>
            }
          />
        </CardHeader>

        <form onSubmit={handleSave}>
          <CardContent className="px-0 space-y-5 pt-2 pb-6">
            {/* Last Backup Status */}
            {schedule?.lastBackupAt && (
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/20 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-status-success shrink-0" />
                  <span className="font-medium text-foreground">Last Successful Snapshot</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
                  <span>{new Date(schedule.lastBackupAt).toLocaleString()}</span>
                  <Badge variant="outline" className="bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs">
                    200 OK
                  </Badge>
                </div>
              </div>
            )}

            {/* Schedule Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label htmlFor="snapshot-toggle" className="text-xs font-medium text-foreground cursor-pointer">
                  Automated Snapshot Schedule
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatically take cluster state snapshots on recurring intervals.
                </p>
              </div>
              <Switch id="snapshot-toggle" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
                {/* Frequency */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Frequency</Label>
                  <SearchableSelect
                    value={frequency}
                    onValueChange={(val) => setFrequency(val as 'daily' | 'weekly')}
                    options={[
                      { value: 'daily', label: 'Daily (Every 24 hours)' },
                      { value: 'weekly', label: 'Weekly (Every 7 days)' },
                    ]}
                    placeholder="Select frequency"
                    searchPlaceholder="Search frequency..."
                  />
                </div>

                {/* Time UTC */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    Time (UTC)
                  </Label>
                  <Input
                    type="time"
                    value={timeUtc}
                    onChange={(e) => setTimeUtc(e.target.value)}
                    className="h-9 font-mono text-sm"
                  />
                </div>

                {/* Retention */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Retention (Days)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    className="h-9 font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {/* Destination Bucket */}
            <div className="space-y-1.5 pt-4 border-t border-border">
              <Label className="text-xs font-medium text-foreground">Destination Storage Bucket</Label>
              <div className="w-full">
                <SearchableSelect
                  value={bucketId}
                  onValueChange={setBucketId}
                  options={buckets.map((b) => ({
                    value: b.id,
                    label: `${b.name} (${b.bucket})`,
                    description: `Endpoint: ${b.endpoint} • Region: ${b.region}`,
                  }))}
                  placeholder="Select destination storage bucket..."
                  searchPlaceholder="Search buckets by name or region..."
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Encrypted snapshots are stored in this S3 compatible bucket.
              </p>
            </div>
          </CardContent>

          <CardFooter className="px-0 pt-6 pb-0 flex justify-end border-t border-border">
            <Button
              type="submit"
              size="default"
              disabled={isSaving}
              className="text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 active:not-aria-[haspopup]:translate-y-px"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save Schedule
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
