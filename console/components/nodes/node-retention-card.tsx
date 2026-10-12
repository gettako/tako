'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  HardDrive,
  Trash2,
  Sparkles,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  getNodeRetentionPolicy,
  updateNodeRetentionPolicy,
  pruneNodeDisk,
} from '@/lib/api/nodes';
import { formatBytes } from '@/lib/utils';
import { NodeRetentionPolicy, NodePruneResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NodeRetentionCardProps {
  nodeId: string;
}

export function NodeRetentionCard({ nodeId }: NodeRetentionCardProps) {
  const [policy, setPolicy] = useState<NodeRetentionPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState<NodePruneResult | null>(null);

  const [keepVersions, setKeepVersions] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(85);
  const [pruneCache, setPruneCache] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function fetchPolicy() {
      try {
        setLoading(true);
        const data = await getNodeRetentionPolicy(nodeId);
        if (mounted) {
          setPolicy(data);
          setKeepVersions(data.keepImageVersions || 3);
          setThreshold(data.autoPruneThresholdPercent || 85);
          setPruneCache(data.pruneBuildCache !== undefined ? data.pruneBuildCache : true);
        }
      } catch (err: unknown) {
        console.error('Failed to load node retention policy', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchPolicy();
    return () => {
      mounted = false;
    };
  }, [nodeId]);

  const isDirty =
    policy &&
    (keepVersions !== policy.keepImageVersions ||
      threshold !== policy.autoPruneThresholdPercent ||
      pruneCache !== policy.pruneBuildCache);

  const handleSavePolicy = async () => {
    try {
      setSaving(true);
      const updated = await updateNodeRetentionPolicy(nodeId, {
        keepImageVersions: keepVersions,
        autoPruneThresholdPercent: threshold,
        pruneBuildCache: pruneCache,
      });
      setPolicy(updated);
      toast.success('Disk cleanup & retention policy updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update policy';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePruneNow = async () => {
    try {
      setPruning(true);
      setPruneResult(null);
      const res = await pruneNodeDisk(nodeId, {
        all: false,
        pruneBuildCache: pruneCache,
      });
      setPruneResult(res);
      toast.success(res.message || `Cleaned ${formatBytes(res.spaceReclaimedBytes)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to prune node disk';
      toast.error(msg);
    } finally {
      setPruning(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card p-6 animate-pulse">
        <div className="h-5 w-48 bg-muted rounded mb-2" />
        <div className="h-4 w-72 bg-muted/60 rounded" />
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card p-6 space-y-6">
      <CardHeader className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <HardDrive className="size-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">
                Docker Image Retention & Disk Cleanup Policy
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Automate node disk hygiene, keep recent release images, and prune builder cache layers on-demand.
            </p>
          </div>

          <Button
            size="sm"
            variant="default"
            disabled={pruning}
            onClick={handlePruneNow}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shrink-0 shadow-xs cursor-pointer"
          >
            {pruning ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Pruning Disk...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                <span>Clean Disk Now</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {/* Prune Result Alert */}
      {pruneResult && (
        <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in-0 duration-200">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <div className="space-y-1">
            <span className="font-semibold text-sm">Disk Cleanup Completed:</span>
            <p className="leading-relaxed">
              Reclaimed{' '}
              <strong className="font-mono">
                {(pruneResult.spaceReclaimedBytes / (1024 * 1024)).toFixed(1)} MB
              </strong>{' '}
              of disk space and purged {pruneResult.imagesDeleted} dangling container/image layer(s).
            </p>
          </div>
        </div>
      )}

      <CardContent className="p-0 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Keep Versions */}
          <div className="space-y-2 rounded-lg border border-border p-4 bg-muted/20">
            <Label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                Retain Release Versions
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{keepVersions} images</span>
            </Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={keepVersions}
              onChange={(e) => setKeepVersions(Number(e.target.value))}
              className="font-mono text-sm bg-background"
              disabled={saving}
            />
            <p className="text-[11px] text-muted-foreground">
              Always retain the N most recent deployment images per service for instant zero-downtime rollback.
            </p>
          </div>

          {/* Disk Threshold */}
          <div className="space-y-2 rounded-lg border border-border p-4 bg-muted/20">
            <Label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-amber-500" />
                Auto-Prune Disk Threshold
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{threshold}%</span>
            </Label>
            <Input
              type="number"
              min={50}
              max={98}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="font-mono text-sm bg-background"
              disabled={saving}
            />
            <p className="text-[11px] text-muted-foreground">
              Trigger background Docker system pruning automatically when host storage exceeds this limit.
            </p>
          </div>

          {/* Prune Build Cache */}
          <div className="space-y-2 rounded-lg border border-border p-4 bg-muted/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Trash2 className="size-3.5 text-muted-foreground" />
                  Prune Build Cache
                </Label>
                <Switch
                  checked={pruneCache}
                  onCheckedChange={setPruneCache}
                  disabled={saving}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Purges intermediate Docker buildkit layers and dangling build artifacts during cleanup cycles.
              </p>
            </div>

            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!isDirty || saving}
                onClick={handleSavePolicy}
                className="w-full gap-1.5 text-xs h-8 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3" />
                    <span>Save Policy Changes</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
