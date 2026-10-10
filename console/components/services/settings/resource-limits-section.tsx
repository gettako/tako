'use client';

import React, { useState, useEffect } from 'react';
import { Service, UpdateServiceInput } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ResourceBar } from '@/components/ui/resource-bar';
import { Cpu, HardDrive, Info, Save, Undo2, RotateCw, Loader2, Layers, Activity, TrendingUp, Clock, Gauge } from 'lucide-react';
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

  // Auto-Scaling (HPA) State & Custom Criteria
  const initialAsEnabled = service.autoScaling?.enabled || false;
  const initialMinReplicas = service.autoScaling?.minReplicas || 1;
  const initialMaxReplicas = service.autoScaling?.maxReplicas || 5;
  const initialTargetCpu = service.autoScaling?.targetCpuPercent || 80;
  const initialAsMetric = service.autoScaling?.metric || 'cpu';
  const initialTargetMem = service.autoScaling?.targetMemoryPercent || 80;
  const initialScaleDownCpu = service.autoScaling?.scaleDownCpuPercent || 25;
  const initialCooldown = service.autoScaling?.cooldownSeconds || 60;

  const [asEnabled, setAsEnabled] = useState(initialAsEnabled);
  const [minReplicas, setMinReplicas] = useState(initialMinReplicas);
  const [maxReplicas, setMaxReplicas] = useState(initialMaxReplicas);
  const [targetCpu, setTargetCpu] = useState(initialTargetCpu);
  const [asMetric, setAsMetric] = useState<'cpu' | 'memory' | 'both'>(initialAsMetric);
  const [targetMem, setTargetMem] = useState(initialTargetMem);
  const [scaleDownCpu, setScaleDownCpu] = useState(initialScaleDownCpu);
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [isSavingAutoScaling, setIsSavingAutoScaling] = useState(false);

  const isAsDirty =
    asEnabled !== initialAsEnabled ||
    minReplicas !== initialMinReplicas ||
    maxReplicas !== initialMaxReplicas ||
    targetCpu !== initialTargetCpu ||
    asMetric !== initialAsMetric ||
    targetMem !== initialTargetMem ||
    scaleDownCpu !== initialScaleDownCpu ||
    cooldown !== initialCooldown;

  const effectiveSwap = enableSwap ? swapMb : 0;
  const isDirty =
    cpuCores !== initialCpu ||
    memoryMb !== initialMem ||
    effectiveSwap !== initialSwap;

  useEffect(() => {
    if (!isDirty) {
      setCpuCores(service.limits.cpuCores || 1);
      setMemoryMb(service.limits.memoryMb || 1024);
      setEnableSwap((service.limits.swapMb || 0) > 0);
      setSwapMb(service.limits.swapMb || 512);
    }
    if (!isAsDirty) {
      setAsEnabled(service.autoScaling?.enabled || false);
      setMinReplicas(service.autoScaling?.minReplicas || 1);
      setMaxReplicas(service.autoScaling?.maxReplicas || 5);
      setTargetCpu(service.autoScaling?.targetCpuPercent || 80);
      setAsMetric(service.autoScaling?.metric || 'cpu');
      setTargetMem(service.autoScaling?.targetMemoryPercent || 80);
      setScaleDownCpu(service.autoScaling?.scaleDownCpuPercent || 25);
      setCooldown(service.autoScaling?.cooldownSeconds || 60);
    }
  }, [service.limits, service.autoScaling, isDirty, isAsDirty]);

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

  const handleSaveAutoScaling = async () => {
    try {
      setIsSavingAutoScaling(true);
      await onUpdate({
        autoScaling: {
          enabled: asEnabled,
          minReplicas,
          maxReplicas,
          targetCpuPercent: targetCpu,
          metric: asMetric,
          targetMemoryPercent: targetMem,
          scaleDownCpuPercent: scaleDownCpu,
          cooldownSeconds: cooldown,
        },
      });
      toast.success('Auto-scaling policy updated successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update auto-scaling policy';
      toast.error(message);
    } finally {
      setIsSavingAutoScaling(false);
    }
  };

  const handleRestartNow = async () => {
    if (!onRestart) return;
    try {
      setIsRestarting(true);
      await onRestart();
      toast.success('Service updated and restarted with new limits');
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
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
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
            {service.status === 'stopped' ? 'Apply & Start' : 'Restart Now'}
          </Button>
        )}
      </div>

      {/* Main Limits Configuration Card */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Cpu}
            title="Compute Quotas & Limits"
            description="Configure hard ceilings for CPU allocation and RAM container memory."
          />
        </CardHeader>

        <CardContent className="px-0 space-y-6 pb-6">
          {/* CPU Allocation Slider & Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
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
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
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
                  className={cn( 'h-7 px-2.5 font-mono text-xs transition-colors', memoryMb === preset ? 'bg-primary text-primary-foreground font-semibold' : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground' )}
                >
                  {formatMemory(preset)}
                </Button>
              ))}
            </div>
          </div>

          {/* Optional Swap Configuration */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="swap-toggle" className="text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer">
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
                <Label className="text-xs font-medium text-foreground">Allocated Swap</Label>
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

        <CardFooter className="px-0 pt-6 pb-0 flex items-center justify-between border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="gap-1.5 text-sm h-9 active:not-aria-[haspopup]:translate-y-px"
          >
            <Undo2 className="size-3.5" />
            Reset
          </Button>

          <Button
            type="button"
            size="default"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="gap-1.5 text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium active:not-aria-[haspopup]:translate-y-px"
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

      {/* Automated Horizontal Auto-Scaling (HPA) Card */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={TrendingUp}
            title="Horizontal Auto-Scaling (HPA)"
            description="Dynamically adjust container replicas based on customizable metrics, thresholds, and cooldown windows."
          />
        </CardHeader>

        <CardContent className="px-0 space-y-5">
          {/* Enable Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
            <div className="space-y-0.5">
              <Label htmlFor="as-toggle" className="text-sm font-semibold text-foreground cursor-pointer">
                Enable Rule-Based Auto-Scaling
              </Label>
              <p className="text-xs text-muted-foreground">
                When container workload exceeds your configured thresholds, additional replicas are spawned automatically.
              </p>
            </div>
            <Switch
              id="as-toggle"
              checked={asEnabled}
              onCheckedChange={setAsEnabled}
            />
          </div>

          {asEnabled && (
            <div className="space-y-6 pt-1">
              {/* Metric Criteria Source Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Gauge className="size-3.5 text-primary" />
                  Scaling Evaluation Metric (Custom Criteria)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAsMetric('cpu')}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all',
                      asMetric === 'cpu'
                        ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                        : 'border-border bg-card/60 hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Cpu className={cn('size-4', asMetric === 'cpu' ? 'text-primary' : 'text-muted-foreground')} />
                    <div>
                      <div className="text-xs font-semibold">CPU Utilization</div>
                      <div className="text-[11px] text-muted-foreground">Scale on processor load</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAsMetric('memory')}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all',
                      asMetric === 'memory'
                        ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                        : 'border-border bg-card/60 hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <HardDrive className={cn('size-4', asMetric === 'memory' ? 'text-primary' : 'text-muted-foreground')} />
                    <div>
                      <div className="text-xs font-semibold">Memory (RAM)</div>
                      <div className="text-[11px] text-muted-foreground">Scale on memory consumption</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAsMetric('both')}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all',
                      asMetric === 'both'
                        ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                        : 'border-border bg-card/60 hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Layers className={cn('size-4', asMetric === 'both' ? 'text-primary' : 'text-muted-foreground')} />
                    <div>
                      <div className="text-xs font-semibold">Both (CPU or RAM)</div>
                      <div className="text-[11px] text-muted-foreground">Scale on either spike</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Replica Boundaries */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Min Replicas */}
                <div className="space-y-1.5">
                  <Label htmlFor="as-min-rep" className="text-xs font-semibold text-foreground">
                    Minimum Replicas
                  </Label>
                  <Input
                    id="as-min-rep"
                    type="number"
                    min={1}
                    max={10}
                    value={minReplicas}
                    onChange={(e) => setMinReplicas(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-9 text-xs sm:text-sm font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Lower replica boundary during quiet/idle traffic.
                  </p>
                </div>

                {/* Max Replicas */}
                <div className="space-y-1.5">
                  <Label htmlFor="as-max-rep" className="text-xs font-semibold text-foreground">
                    Maximum Replicas
                  </Label>
                  <Input
                    id="as-max-rep"
                    type="number"
                    min={minReplicas}
                    max={20}
                    value={maxReplicas}
                    onChange={(e) => setMaxReplicas(Math.max(minReplicas, parseInt(e.target.value, 10) || minReplicas))}
                    className="h-9 text-xs sm:text-sm font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Upper boundary ceiling during peak traffic bursts.
                  </p>
                </div>
              </div>

              {/* CPU Thresholds (Shown if metric is CPU or Both) */}
              {(asMetric === 'cpu' || asMetric === 'both') && (
                <div className="p-4 rounded-lg border border-border bg-card/40 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Cpu className="size-4 text-primary" />
                    CPU Scaling Thresholds
                  </div>

                  {/* Target CPU Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        Scale-Up Target CPU Threshold
                      </Label>
                      <span className="text-xs font-mono font-bold text-primary">
                        {targetCpu}%
                      </span>
                    </div>
                    <Slider
                      min={30}
                      max={95}
                      step={5}
                      value={[targetCpu]}
                      onValueChange={(val) => setTargetCpu(Array.isArray(val) ? val[0] : Number(val))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                      <span>50% (Conservative)</span>
                      <span>70% (Balanced)</span>
                      <span>85%+ (Aggressive)</span>
                    </div>
                  </div>

                  {/* Scale Down CPU Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="as-scale-down" className="text-xs text-muted-foreground">
                        Scale-Down CPU Threshold (%)
                      </Label>
                      <Input
                        id="as-scale-down"
                        type="number"
                        min={10}
                        max={Math.max(15, targetCpu - 10)}
                        value={scaleDownCpu}
                        onChange={(e) => setScaleDownCpu(Math.max(5, Math.min(targetCpu - 5, parseFloat(e.target.value) || 25)))}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center">
                      Replicas scale down when average CPU stays below {scaleDownCpu}% and count exceeds min replicas.
                    </div>
                  </div>
                </div>
              )}

              {/* RAM Thresholds (Shown if metric is Memory or Both) */}
              {(asMetric === 'memory' || asMetric === 'both') && (
                <div className="p-4 rounded-lg border border-border bg-card/40 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <HardDrive className="size-4 text-primary" />
                    Memory (RAM) Scaling Thresholds
                  </div>

                  {/* Target RAM Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        Scale-Up Target RAM Threshold
                      </Label>
                      <span className="text-xs font-mono font-bold text-primary">
                        {targetMem}%
                      </span>
                    </div>
                    <Slider
                      min={40}
                      max={95}
                      step={5}
                      value={[targetMem]}
                      onValueChange={(val) => setTargetMem(Array.isArray(val) ? val[0] : Number(val))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                      <span>60% (Cautious)</span>
                      <span>80% (Recommended)</span>
                      <span>90%+ (High Capacity)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stabilization Cooldown Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center p-3.5 rounded-lg border border-border bg-card/20">
                <div className="space-y-0.5">
                  <Label htmlFor="as-cooldown" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    Stabilization Cooldown Window
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Delay period enforced between consecutive scaling operations to avoid flapping.
                  </p>
                </div>
                <div>
                  <select
                    id="as-cooldown"
                    value={cooldown}
                    onChange={(e) => setCooldown(parseInt(e.target.value, 10) || 60)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={30}>30 seconds (Fast Reaction)</option>
                    <option value={60}>60 seconds (Standard - Recommended)</option>
                    <option value={120}>120 seconds (Steady Traffic)</option>
                    <option value={300}>300 seconds (Conservative / 5 min)</option>
                  </select>
                </div>
              </div>

              {/* Live Metric Comparison Banner */}
              <div className="p-3.5 rounded-lg border border-border bg-muted/10 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Activity className="size-3.5 text-primary" />
                    Live Telemetry Status:
                  </span>
                  <span className="font-mono text-foreground text-xs font-semibold">
                    CPU: {service.usage.cpuPercent}% | RAM: {service.limits.memoryMb > 0 ? Math.round((service.usage.memoryUsedMb / service.limits.memoryMb) * 100) : 0}% ({service.usage.memoryUsedMb}MB)
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                  <span className="text-muted-foreground">
                    Policy Trigger: Metric: <strong className="capitalize text-foreground">{asMetric}</strong> (Cooldown: {cooldown}s)
                  </span>
                  <span className={cn(
                    'font-medium text-[11px] px-2 py-0.5 rounded',
                    (asMetric === 'cpu' && service.usage.cpuPercent > targetCpu) ||
                    (asMetric === 'memory' && (service.limits.memoryMb > 0 && (service.usage.memoryUsedMb / service.limits.memoryMb) * 100 > targetMem)) ||
                    (asMetric === 'both' && (service.usage.cpuPercent > targetCpu || (service.limits.memoryMb > 0 && (service.usage.memoryUsedMb / service.limits.memoryMb) * 100 > targetMem)))
                      ? 'bg-status-danger/10 text-status-danger'
                      : 'bg-status-success/10 text-status-success'
                  )}>
                    {(asMetric === 'cpu' && service.usage.cpuPercent > targetCpu) ||
                    (asMetric === 'memory' && (service.limits.memoryMb > 0 && (service.usage.memoryUsedMb / service.limits.memoryMb) * 100 > targetMem)) ||
                    (asMetric === 'both' && (service.usage.cpuPercent > targetCpu || (service.limits.memoryMb > 0 && (service.usage.memoryUsedMb / service.limits.memoryMb) * 100 > targetMem)))
                      ? 'Scale-Up Threshold Exceeded'
                      : 'Operating within Target Limits'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="px-0 pb-0 pt-4 flex items-center justify-end border-t border-border">
          <Button
            type="button"
            size="default"
            onClick={handleSaveAutoScaling}
            disabled={!isAsDirty || isSavingAutoScaling}
            className="gap-1.5 text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {isSavingAutoScaling ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving Auto-Scaling...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save Auto-Scaling Policy
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Utilization vs Limit Comparison Card */}
      <Card className="border-border bg-card p-6">
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
