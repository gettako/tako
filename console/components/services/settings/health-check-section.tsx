'use client';

import React, { useState, useEffect } from 'react';
import { Service, UpdateServiceInput } from '@/lib/types';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import {
  HeartPulse,
  Save,
  Undo2,
  Loader2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sliders,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HealthCheckSectionProps {
  service: Service;
  onUpdate: (input: UpdateServiceInput) => Promise<void>;
}

export function HealthCheckSection({ service, onUpdate }: HealthCheckSectionProps) {
  const [path, setPath] = useState(service.healthCheckPath || '/healthz');
  const [port, setPort] = useState<number>(service.healthCheckPort || service.ports?.[0] || 80);
  const [interval, setInterval] = useState<number>(service.healthCheckInterval || 15);
  const [timeout, setTimeoutVal] = useState<number>(service.healthCheckTimeout || 5);
  const [retries, setRetries] = useState<number>(service.healthCheckRetries || 3);
  const [initialDelay, setInitialDelay] = useState<number>(service.healthCheckInitialDelay || 5);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    path !== (service.healthCheckPath || '/healthz') ||
    port !== (service.healthCheckPort || service.ports?.[0] || 80) ||
    interval !== (service.healthCheckInterval || 15) ||
    timeout !== (service.healthCheckTimeout || 5) ||
    retries !== (service.healthCheckRetries || 3) ||
    initialDelay !== (service.healthCheckInitialDelay || 5);

  useEffect(() => {
    if (!isDirty) {
      setPath(service.healthCheckPath || '/healthz');
      setPort(service.healthCheckPort || service.ports?.[0] || 80);
      setInterval(service.healthCheckInterval || 15);
      setTimeoutVal(service.healthCheckTimeout || 5);
      setRetries(service.healthCheckRetries || 3);
      setInitialDelay(service.healthCheckInitialDelay || 5);
    }
  }, [service, isDirty]);

  const handleReset = () => {
    setPath(service.healthCheckPath || '/healthz');
    setPort(service.healthCheckPort || service.ports?.[0] || 80);
    setInterval(service.healthCheckInterval || 15);
    setTimeoutVal(service.healthCheckTimeout || 5);
    setRetries(service.healthCheckRetries || 3);
    setInitialDelay(service.healthCheckInitialDelay || 5);
  };

  const applyPreset = (preset: 'standard' | 'fast' | 'slow') => {
    if (preset === 'standard') {
      setPath('/healthz');
      setInterval(15);
      setTimeoutVal(5);
      setRetries(3);
      setInitialDelay(5);
    } else if (preset === 'fast') {
      setPath('/');
      setInterval(5);
      setTimeoutVal(2);
      setRetries(2);
      setInitialDelay(2);
    } else {
      setPath('/health');
      setInterval(30);
      setTimeoutVal(10);
      setRetries(5);
      setInitialDelay(20);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) {
      toast.error('Health check path cannot be empty');
      return;
    }
    if (port <= 0 || port > 65535) {
      toast.error('Port must be between 1 and 65535');
      return;
    }
    if (interval < 1) {
      toast.error('Interval must be at least 1 second');
      return;
    }

    try {
      setIsSaving(true);
      await onUpdate({
        healthCheckPath: path.trim(),
        healthCheckPort: Number(port),
        healthCheckInterval: Number(interval),
        healthCheckTimeout: Number(timeout),
        healthCheckRetries: Number(retries),
        healthCheckInitialDelay: Number(initialDelay),
      });
      toast.success('Health check probe settings updated successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update health check settings';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigured = Boolean(service.healthCheckPath);

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Overview Card */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <SectionHeader
              icon={HeartPulse}
              title="Health Check Probes"
              description="Configure active HTTP/TCP liveness checks for Docker container supervision and Traefik load balancing."
            />
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono',
                isConfigured
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border border-border'
              )}>
                <CheckCircle2 className="size-3.5" />
                <span>{isConfigured ? 'Custom Probe Active' : 'Default /healthz Probe'}</span>
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 space-y-6 pt-2">
          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <span className="text-xs text-muted-foreground font-medium mr-1">Presets:</span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => applyPreset('standard')}
              className="text-xs h-7 gap-1 border-border"
            >
              <Sliders className="size-3 text-primary" />
              Standard Web (/healthz, 15s)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => applyPreset('fast')}
              className="text-xs h-7 gap-1 border-border"
            >
              <Clock className="size-3 text-amber-500" />
              Fast Failover (/, 5s)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => applyPreset('slow')}
              className="text-xs h-7 gap-1 border-border"
            >
              <ShieldCheck className="size-3 text-purple-500" />
              Heavy App (/health, 30s)
            </Button>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Path */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Probe Endpoint / Path</span>
                <span className="text-[10px] text-muted-foreground font-mono">e.g. /healthz</span>
              </Label>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/healthz"
                className="font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-[11px] text-muted-foreground">
                HTTP GET endpoint in your application returning status 200–399.
              </p>
            </div>

            {/* Port */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Target Port</span>
                <span className="text-[10px] text-muted-foreground font-mono">TCP Port</span>
              </Label>
              <Input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-[11px] text-muted-foreground">
                Internal container port where the health check endpoint listens.
              </p>
            </div>

            {/* Interval */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Probe Interval (seconds)</span>
                <span className="text-[10px] text-muted-foreground font-mono">{interval}s</span>
              </Label>
              <Input
                type="number"
                min={1}
                max={3600}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-[11px] text-muted-foreground">
                Time elapsed between consecutive health probe executions.
              </p>
            </div>

            {/* Timeout */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Timeout (seconds)</span>
                <span className="text-[10px] text-muted-foreground font-mono">{timeout}s</span>
              </Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={timeout}
                onChange={(e) => setTimeoutVal(Number(e.target.value))}
                className="font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-[11px] text-muted-foreground">
                Maximum time allowed for the endpoint to respond before timing out.
              </p>
            </div>

            {/* Retries */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Consecutive Retries</span>
                <span className="text-[10px] text-muted-foreground font-mono">{retries} fails</span>
              </Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={retries}
                onChange={(e) => setRetries(Number(e.target.value))}
                className="font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-[11px] text-muted-foreground">
                Number of consecutive failed attempts required to declare the container unhealthy.
              </p>
            </div>

            {/* Initial Delay */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Initial Delay / Grace Period (seconds)</span>
                <span className="text-[10px] text-muted-foreground font-mono">{initialDelay}s</span>
              </Label>
              <Input
                type="number"
                min={0}
                max={600}
                value={initialDelay}
                onChange={(e) => setInitialDelay(Number(e.target.value))}
                className="font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-[11px] text-muted-foreground">
                Grace duration allowed for cold application startup before failing probes.
              </p>
            </div>
          </div>

          {/* Engine Integration Preview */}
          <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Terminal className="size-3.5 text-primary" />
              <span>Generated Docker & Traefik Probe Rules</span>
            </div>
            <div className="font-mono text-xs text-muted-foreground bg-background/80 rounded-md p-3 border border-border/60 overflow-x-auto space-y-1">
              <div>
                <span className="text-primary">Docker:</span> CMD-SHELL wget -q -O - http://127.0.0.1:{port}{path} &gt; /dev/null || exit 1
              </div>
              <div>
                <span className="text-primary">Traefik:</span> loadBalancer.healthCheck.path=&quot;{path}&quot; interval=&quot;{interval}s&quot; timeout=&quot;{timeout}s&quot;
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="px-0 pt-6 pb-0 flex items-center justify-between border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="gap-1.5 text-sm h-9"
          >
            <Undo2 className="size-3.5" />
            Discard Changes
          </Button>

          <Button
            type="submit"
            size="default"
            disabled={!isDirty || isSaving}
            className="gap-1.5 text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save Health Check Probes
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
