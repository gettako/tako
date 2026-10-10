'use client';

import React, { useState } from 'react';
import {
  useBackupSchedule,
  useUpdateBackupSchedule,
  useTriggerManualBackup,
  useBackupSnapshots,
  useRestoreBackupSnapshot,
  useS3Buckets,
} from '@/lib/queries';
import { ClusterBackupSnapshot } from '@/lib/types';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Database,
  CheckCircle2,
  Play,
  Save,
  Loader2,
  Clock,
  RotateCcw,
  Archive,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { SettingsSectionHeader } from '@/components/settings/settings-section-header';
import { toast } from 'sonner';

export function BackupsPanel() {
  const [isTriggering, setIsTriggering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ClusterBackupSnapshot | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  const { data: schedule } = useBackupSchedule();
  const { data: snapshots = [], isLoading: loadingSnapshots } = useBackupSnapshots();
  const { data: buckets = [] } = useS3Buckets();

  const updateScheduleMutation = useUpdateBackupSchedule();
  const triggerBackupMutation = useTriggerManualBackup();
  const restoreSnapshotMutation = useRestoreBackupSnapshot();

  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(schedule?.frequency ?? 'daily');
  const [timeUtc, setTimeUtc] = useState(schedule?.timeUtc ?? '03:00');
  const [retentionDays, setRetentionDays] = useState(schedule?.retentionDays ?? 30);
  const [bucketId, setBucketId] = useState(schedule?.destinationBucketId ?? (buckets[0]?.id || ''));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateScheduleMutation.mutateAsync({
        enabled,
        frequency,
        timeUtc,
        retentionDays,
        destinationBucketId: bucketId,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackupNow = async () => {
    try {
      setIsTriggering(true);
      await triggerBackupMutation.mutateAsync();
    } finally {
      setIsTriggering(false);
    }
  };

  const handleOpenRestore = (snapshot: ClusterBackupSnapshot) => {
    setSelectedSnapshot(snapshot);
    setConfirmText('');
    setRestoreModalOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedSnapshot) return;
    try {
      setIsRestoring(true);
      await restoreSnapshotMutation.mutateAsync(selectedSnapshot.id);
      setRestoreModalOpen(false);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Automated Schedule & Snapshot Generator */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SettingsSectionHeader
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

      {/* 2. Cluster Snapshot Files Listing & Restore */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SettingsSectionHeader
            icon={Archive}
            title="Cluster Snapshots History"
            description="Available snapshot archives in storage. You can inspect checksums or validate and restore state."
          />
        </CardHeader>

        <CardContent className="px-0 pt-2 pb-0">
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[340px]">Snapshot Archive</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Checksum</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                      No backup snapshots found. Click &quot;Backup Now&quot; above to create your first snapshot.
                    </TableCell>
                  </TableRow>
                ) : (
                  snapshots.map((snap) => (
                    <TableRow key={snap.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-primary shrink-0" />
                          <span className="truncate">{snap.filename}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {snap.sizeMb.toFixed(1)} MB
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground/80 max-w-[140px] truncate">
                        {snap.checksum}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(snap.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-status-success/10 text-status-success border-status-success/30 font-mono text-[11px]"
                        >
                          {snap.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRestore(snap)}
                          className="h-7 text-xs font-medium gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                        >
                          <RotateCcw className="size-3" />
                          <span>Restore</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Restore Snapshot Confirmation Modal */}
      <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
        <DialogContent className="sm:max-w-md border-amber-500/40">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5 shrink-0" />
              <DialogTitle className="text-base font-semibold">
                Confirm Cluster Snapshot Restore
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs leading-relaxed pt-2 space-y-2">
              <p>
                You are about to restore the cluster state from snapshot:
              </p>
              <div className="p-2.5 rounded-lg bg-muted border border-border font-mono text-xs text-foreground select-all">
                {selectedSnapshot?.filename}
              </div>
              <p className="text-destructive font-medium">
                Warning: Restoring will overwrite control plane database metadata and re-synchronize active services to this snapshot state.
              </p>
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground">
                  Type <strong className="text-foreground font-mono">RESTORE</strong> to confirm:
                </Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESTORE"
                  className="font-mono text-xs mt-1 h-8"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRestoreModalOpen(false)}
              className="text-sm h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={confirmText !== 'RESTORE' || isRestoring}
              onClick={handleConfirmRestore}
              className="text-sm h-9 bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5"
            >
              {isRestoring ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              Confirm Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
