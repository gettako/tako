'use client';

import React, { useState } from 'react';
import { Service } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeleteServiceDialog } from './delete-service-dialog';
import { SectionHeader } from '@/components/ui/section-header';
import { AlertTriangle, Trash2, RotateCw, RefreshCw, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';

interface DangerZoneSectionProps {
  service: Service;
  onRestart?: () => Promise<void>;
  onStart?: () => Promise<void>;
  onRebuild?: () => Promise<void>;
}

export function DangerZoneSection({
  service,
  onRestart,
  onStart,
  onRebuild,
}: DangerZoneSectionProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);

  const isStopped = service.status === 'stopped';

  const handleStart = async () => {
    try {
      setIsStarting(true);
      if (onStart) {
        await onStart();
      }
      toast.success('Service containers successfully started');
    } catch {
      toast.error('Failed to start service');
    } finally {
      setIsStarting(false);
    }
  };

  const handleForceRestart = async () => {
    try {
      setIsRestarting(true);
      if (onRestart) {
        await onRestart();
      }
      toast.success('Service containers successfully restarted');
    } catch {
      toast.error('Failed to restart service');
    } finally {
      setIsRestarting(false);
    }
  };

  const handleRebuildWithoutCache = async () => {
    try {
      setIsRebuilding(true);
      if (onRebuild) {
        await onRebuild();
      }
      toast.success('Clean rebuild without cache initiated');
    } catch {
      toast.error('Failed to trigger rebuild');
    } finally {
      setIsRebuilding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clean Premium Danger Zone Card */}
      <Card className="rounded-xl border border-destructive/30 dark:border-destructive/40 bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-6 border-b border-border">
          <SectionHeader
            icon={AlertTriangle}
            iconContainerClassName="border-destructive/25 bg-destructive/10 text-destructive "
            iconClassName="text-destructive size-4"
            title="Danger Zone"
            description="Irreversible operations and destructive administrative interventions."
          />
        </CardHeader>

        <CardContent className="px-0 divide-y divide-border/60">
          {/* Action 1: Start or Force Restart Service */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 py-6 first:pt-6">
            <div className="space-y-1.5 sm:max-w-xl">
              <div className="text-sm font-semibold text-foreground">
                {isStopped ? 'Start Service Containers' : 'Force Restart Containers'}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isStopped
                  ? 'Spins up container instances for this stopped service and binds routing.'
                  : 'Tears down all active container replicas for this service and spins up fresh instances.'}
              </p>
            </div>
            {isStopped ? (
              <Button
                type="button"
                size="sm"
                onClick={handleStart}
                disabled={isStarting}
                className="text-sm h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 gap-1.5 shrink-0 font-medium"
              >
                {isStarting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5 fill-current" />
                )}
                <span>Start Service</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleForceRestart}
                disabled={isRestarting}
                className="text-sm h-9 px-4 border-border hover:bg-muted text-foreground gap-1.5 shrink-0 active:not-aria-[haspopup]:translate-y-px"
              >
                {isRestarting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCw className="size-3.5" />
                )}
                <span>Force Restart</span>
              </Button>
            )}
          </div>

          {/* Action 2: Rebuild Without Cache (App / Compose only) */}
          {service.type !== 'database' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 py-6">
              <div className="space-y-1.5 sm:max-w-xl">
                <div className="text-sm font-semibold text-foreground">Clean Rebuild Without Cache</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Invalidates all Docker image layer caches and runs a clean from-scratch build.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRebuildWithoutCache}
                disabled={isRebuilding}
                className="text-sm h-9 px-4 border-border hover:bg-muted text-foreground gap-1.5 shrink-0 active:not-aria-[haspopup]:translate-y-px"
              >
                {isRebuilding ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Rebuild No-Cache
              </Button>
            </div>
          )}

          {/* Action 3: Permanently Delete Service */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 py-6 last:pb-2">
            <div className="space-y-1.5 sm:max-w-xl">
              <div className="text-sm font-semibold text-foreground">Permanently Delete This Service</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Removes all deployment history, environment configurations, and stops all running tasks.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-sm h-9 px-4 font-medium gap-1.5 shrink-0 active:not-aria-[haspopup]:translate-y-px"
            >
              <Trash2 className="size-3.5" />
              <span>Delete Service</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Service Confirmation Challenge Dialog */}
      <DeleteServiceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        service={service}
      />
    </div>
  );
}
