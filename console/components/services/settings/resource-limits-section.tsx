'use client';

import React, { useState } from 'react';
import { Service, UpdateServiceInput } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ResourceBar } from '@/components/ui/resource-bar';
import { Cpu, HardDrive, Info, Save, Undo2, RotateCw, Loader2, Layers, Activity } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ResourceLimitsSectionProps {
  service: Service;
  onUpdate: (input: UpdateServiceInput) => Promise<void>;
  onRestart?: () => Promise<void>;
}

export function ResourceLimitsSection({
  service,
  onUpdate,
  onRestart,
}: ResourceLimitsSectionProps) {
  const initialCpu = service.limits.cpuCores || 1;
  const initialMem = service.limits.memoryMb || 1024;
  const initialSwap = service.limits.swapMb || 0;
  const initialEnableSwap = (service.limits.swapMb || 0) > 0;

  const [cpuCores, setCpuCores] = useState(initialCpu);
  const [memoryMb, setMemoryMb] = useState(initialMem);
  const [enableSwap, setEnableSwap] = useState(initialEnableSwap);
  const [swapMb, setSwapMb] = useState(initialSwap || 512);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const effectiveSwap = enableSwap ? swapMb : 0;
  const isDirty =
    cpuCores !== initialCpu ||
    memoryMb !== initialMem ||
    effectiveSwap !== initialSwap;

  const handleReset = () => {
    setCpuCores(initialCpu);
    setMemoryMb(initialMem);
    setEnableSwap(initialEnableSwap);
    setSwapMb(initialSwap || 512);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onUpdate({
        limits: {
          cpuCores,
          memoryMb,
          swapMb: effectiveSwap,
        },
      });
      toast.success('Resource limits updated successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update resource limits';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestartNow = async () => {
    if (!onRestart) return;
    try {
      setIsRestarting(true);
      await onRestart();
      toast.success('Service restarted. New resource limits applied.');
    } catch {
      toast.error('Failed to restart service');
    } finally {
      setIsRestarting(false);
    }
  };

  // Helper for human memory formatting
  const formatMemory = (mb: number) => {
    if (mb >= 1024) {
      const gb = mb / 1024;
      return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Informational Alert Banner (AC-3) */}
      <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/30 p-4">
        <Info className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <span className="font-semibold text-foreground">Notice: </span>
          <span className="text-muted-foreground">
            Changes to CPU, Memory, or Swap limits require a container restart to take effect on the host system.
          </span>
        </div>
        {onRestart && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRestartNow}
            disabled={isRestarting}
            className="text-sm h-8 gap-1.5 shrink-0"
          >
            {isRestarting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCw className="size-3.5" />
            )}
            Restart Now
          </Button>
        )}
      </div>

      {/* Main Limits Configuration Card */}
      <Card className="border-border/60 bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Cpu}
            title="Compute Quotas & Limits"
            description="Configure hard ceilings for CPU allocation and RAM container memory."
          />
        </CardHeader>

        <CardContent className="px-0 space-y-6">
          {/* CPU Allocation Slider & Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Cpu className="size-4 text-primary" />
                CPU Limit (Cores)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.25"
                  max="16"
                  step="0.25"
                  value={cpuCores}
                  onChange={(e) => setCpuCores(Math.max(0.25, Number(e.target.value) || 0.25))}
                  className="w-24 h-9 text-sm font-mono text-right"
                  disabled={isSaving}
                />
                <span className="text-sm text-muted-foreground font-mono">cores</span>
              </div>
            </div>

            <Slider
              value={[cpuCores]}
              min={0.25}
              max={8}
              step={0.25}
              onValueChange={(val) => {
                const arr = Array.isArray(val) ? val : [val];
                if (arr[0] !== undefined) setCpuCores(arr[0]);
              }}
              disabled={isSaving}
              className="py-1"
            />

            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>0.25 core (250m)</span>
              <span>2 cores</span>
              <span>4 cores</span>
              <span>8 cores</span>
            </div>
          </div>

          {/* Memory Limit Slider & Input */}
          <div className="space-y-3 pt-4 border-t border-border/40">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Layers className="size-4 text-status-success" />
                Memory Limit (RAM)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="128"
                  max="32768"
                  step="128"
                  value={memoryMb}
                  onChange={(e) => setMemoryMb(Math.max(128, Number(e.target.value) || 128))}
                  className="w-28 h-9 text-sm font-mono text-right"
                  disabled={isSaving}
                />
                <span className="text-sm text-muted-foreground font-mono">
                  MB ({formatMemory(memoryMb)})
                </span>
              </div>
            </div>

            <Slider
              value={[memoryMb]}
              min={256}
              max={8192}
              step={256}
              onValueChange={(val) => {
                const arr = Array.isArray(val) ? val : [val];
                if (arr[0] !== undefined) setMemoryMb(arr[0]);
              }}
              disabled={isSaving}
              className="py-1"
            />

            {/* Quick Presets */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Presets:</span>
              {[512, 1024, 2048, 4096, 8192].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={memoryMb === preset ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMemoryMb(preset)}
                  disabled={isSaving}
                  className={cn(
                    'h-7 px-2.5 font-mono text-xs transition-colors',
                    memoryMb === preset
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {formatMemory(preset)}
                </Button>
              ))}
            </div>
          </div>

          {/* Optional Swap Configuration */}
          <div className="space-y-3 pt-4 border-t border-border/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="swap-toggle" className="text-sm font-medium text-foreground flex items-center gap-1.5 cursor-pointer">
                  <HardDrive className="size-4 text-status-warning" />
                  Swap Space
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enable additional disk-backed swap to prevent out-of-memory kernel panics.
                </p>
              </div>
              <Switch
                id="swap-toggle"
                checked={enableSwap}
                onCheckedChange={setEnableSwap}
                disabled={isSaving}
              />
            </div>

            {enableSwap && (
              <div className="flex items-center justify-between pt-2">
                <Label className="text-sm font-medium text-foreground">Allocated Swap</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="128"
                    max="8192"
                    step="128"
                    value={swapMb}
                    onChange={(e) => setSwapMb(Math.max(128, Number(e.target.value) || 128))}
                    className="w-28 h-9 text-sm font-mono text-right"
                    disabled={isSaving}
                  />
                  <span className="text-sm text-muted-foreground font-mono">
                    MB ({formatMemory(swapMb)})
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="px-0 pt-4 pb-0 flex items-center justify-between border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="gap-1.5 text-sm"
          >
            <Undo2 className="size-3.5" />
            Reset
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="gap-1.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save Limits
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Utilization vs Limit Comparison Card */}
      <Card className="border-border/60 bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Activity}
            title="Current Usage vs Proposed Ceiling"
            description="Review how the current live container telemetry compares to your configured limits."
          />
        </CardHeader>

        <CardContent className="px-0 space-y-4">
          <div className="space-y-1.5">
            <ResourceBar
              label="CPU Utilization"
              value={service.usage.cpuPercent}
              max={100}
              unit="%"
              showPercentage
            />
            <p className="text-sm text-muted-foreground">
              Current load: {service.usage.cpuPercent}% of allocated {cpuCores} core(s).
            </p>
          </div>

          <div className="space-y-1.5 pt-2">
            <ResourceBar
              label="RAM Utilization"
              value={service.usage.memoryUsedMb}
              max={memoryMb}
              unit="MB"
              showPercentage
            />
            <p className="text-sm text-muted-foreground">
              Current consumption: {service.usage.memoryUsedMb} MB out of {memoryMb} MB limit.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
