'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNodeTraefikConfig,
  updateNodeTraefikConfig,
  reloadNodeTraefik,
} from '@/lib/api/nodes';
import { Node, NodeTraefikConfig } from '@/lib/types';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  ShieldCheck,
  Save,
  Loader2,
  RefreshCw,
  FolderTree,
  Radio,
  Sliders,
  AlertCircle,
  ExternalLink,
  Layers,
  Lock,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';
import { NodeTraefikFiles } from './node-traefik-files';

interface NodeTraefikPanelProps {
  node: Node;
}

export function NodeTraefikPanel({ node }: NodeTraefikPanelProps) {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'files'>('settings');

  const {
    data: config,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['node-traefik', node.id],
    queryFn: () => getNodeTraefikConfig(node.id),
  });

  const [enabled, setEnabled] = useState(true);
  const [httpPort, setHttpPort] = useState(80);
  const [httpsPort, setHttpsPort] = useState(443);
  const [dashboardEnabled, setDashboardEnabled] = useState(false);
  const [dashboardPort, setDashboardPort] = useState(8080);
  const [acmeEmail, setAcmeEmail] = useState('admin@gettako.dev');
  const [logLevel, setLogLevel] = useState<'DEBUG' | 'INFO' | 'WARN' | 'ERROR'>('INFO');
  const [accessLogEnabled, setAccessLogEnabled] = useState(true);
  const [forceHttps, setForceHttps] = useState(true);
  const [dynamicConfigDir, setDynamicConfigDir] = useState('/etc/tako/traefik/dynamic');
  const [metricsEnabled, setMetricsEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled ?? true);
      setHttpPort(config.httpPort ?? 80);
      setHttpsPort(config.httpsPort ?? 443);
      setDashboardEnabled(config.dashboardEnabled ?? false);
      setDashboardPort(config.dashboardPort ?? 8080);
      setAcmeEmail(config.acmeEmail || 'admin@gettako.dev');
      setLogLevel(config.logLevel || 'INFO');
      setAccessLogEnabled(config.accessLogEnabled ?? true);
      setForceHttps(config.forceHttps ?? true);
      setDynamicConfigDir(config.dynamicConfigDir || '/etc/tako/traefik/dynamic');
      setMetricsEnabled(config.metricsEnabled ?? true);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: (newCfg: Partial<NodeTraefikConfig>) =>
      updateNodeTraefikConfig(node.id, newCfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['node-traefik', node.id] });
      toast.success('Node Traefik configuration saved successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update Traefik configuration';
      toast.error(msg);
    },
  });

  const reloadMutation = useMutation({
    mutationFn: () => reloadNodeTraefik(node.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['node-traefik', node.id] });
      toast.success(data.message || 'Traefik configuration reloaded');
    },
    onError: () => toast.error('Failed to reload Traefik configuration'),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (httpPort === httpsPort) {
      setErrorMsg('HTTP and HTTPS ports cannot be identical');
      toast.error('HTTP and HTTPS ports cannot be identical');
      return;
    }

    if (httpPort <= 0 || httpPort > 65535 || httpsPort <= 0 || httpsPort > 65535) {
      setErrorMsg('Ports must be between 1 and 65535');
      toast.error('Invalid port numbers');
      return;
    }

    updateMutation.mutate({
      enabled,
      httpPort,
      httpsPort,
      dashboardEnabled,
      dashboardPort,
      acmeEmail: acmeEmail.trim(),
      logLevel,
      accessLogEnabled,
      forceHttps,
      dynamicConfigDir: dynamicConfigDir.trim(),
      metricsEnabled,
    });
  };

  if (isLoading && !config) {
    return (
      <Card className="border-border bg-card p-6">
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Loading node Traefik settings...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={Sliders}
          title="Traefik Ingress Configuration"
          description={`Configure edge reverse proxy routing, Let's Encrypt TLS, and ports for ${node.name}.`}
          action={
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  enabled
                    ? 'bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs gap-1'
                    : 'bg-muted text-muted-foreground border-border font-mono text-xs'
                }
              >
                <Radio className="size-3" />
                {enabled ? 'Ingress Active' : 'Ingress Disabled'}
              </Badge>

              <Button
                variant="outline"
                size="sm"
                onClick={() => reloadMutation.mutate()}
                disabled={reloadMutation.isPending || !enabled}
                className="text-xs h-8 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
                title="Trigger dynamic routing reload on this node"
              >
                <RefreshCw
                  className={`size-3.5 ${reloadMutation.isPending ? 'animate-spin text-primary' : 'text-muted-foreground'}`}
                />
                <span>Reload Traefik</span>
              </Button>
            </div>
          }
        />
      </CardHeader>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px active:not-aria-[haspopup]:translate-y-px ${
            activeSubTab === 'settings'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="size-3.5" />
          <span>Ingress Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('files')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px active:not-aria-[haspopup]:translate-y-px ${
            activeSubTab === 'files'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderTree className="size-3.5" />
          <span>Dynamic Config Files & Editor</span>
        </button>
      </div>

      {activeSubTab === 'files' ? (
        <NodeTraefikFiles node={node} />
      ) : (
        <form onSubmit={handleSave}>
        <CardContent className="px-0 space-y-6 pt-2 pb-6">
          {/* Node Edge Telemetry Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1">
              <span className="text-muted-foreground text-[10px] uppercase font-sans">Edge Ingress IP</span>
              <div className="font-semibold text-foreground truncate select-all">{node.publicIp || node.ipAddress}</div>
              <div className="text-[10px] text-muted-foreground font-sans">Public cluster entry</div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1">
              <span className="text-muted-foreground text-[10px] uppercase font-sans">Ingress Ports</span>
              <div className="font-semibold text-foreground">
                HTTP :{httpPort} • HTTPS :{httpsPort}
              </div>
              <div className="text-[10px] text-muted-foreground font-sans">Standard proxy ports</div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1">
              <span className="text-muted-foreground text-[10px] uppercase font-sans">Active Routers</span>
              <div className="font-semibold text-foreground">
                {config?.activeRoutersCount ?? 0} Container Routers
              </div>
              <div className="text-[10px] text-muted-foreground font-sans">Attached to this node</div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1">
              <span className="text-muted-foreground text-[10px] uppercase font-sans">Last Reloaded</span>
              <div className="font-semibold text-foreground truncate">
                {config?.lastReloadedAt ? new Date(config.lastReloadedAt).toLocaleTimeString() : 'Recently'}
              </div>
              <div className="text-[10px] text-muted-foreground font-sans">Hot reload synced</div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg border border-status-danger/30 bg-status-danger/10 text-status-danger text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Core Ports & Network Settings */}
          <div className="space-y-4">
            <div className="font-semibold text-sm text-foreground flex items-center gap-2 border-b border-border pb-2">
              <Layers className="size-4 text-primary" />
              <span>Network Entrypoints & Routing</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">HTTP EntryPoint Port</Label>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={httpPort}
                  onChange={(e) => setHttpPort(parseInt(e.target.value) || 80)}
                  disabled={updateMutation.isPending}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Default web entrypoint (port 80).</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">HTTPS (TLS) EntryPoint Port</Label>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={httpsPort}
                  onChange={(e) => setHttpsPort(parseInt(e.target.value) || 443)}
                  disabled={updateMutation.isPending}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Default websecure entrypoint (port 443).</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Log Level</Label>
                <SearchableSelect
                  value={logLevel}
                  onValueChange={(val) => setLogLevel(val as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR')}
                  options={[
                    { value: 'DEBUG', label: 'DEBUG (Detailed traces)' },
                    { value: 'INFO', label: 'INFO (Normal operations)' },
                    { value: 'WARN', label: 'WARN (Warnings only)' },
                    { value: 'ERROR', label: 'ERROR (Critical errors)' },
                  ]}
                  searchPlaceholder="Filter log level..."
                />
                <p className="text-[11px] text-muted-foreground">Verbosity for Traefik stdout logs.</p>
              </div>
            </div>

            {/* Toggle Switches: Force HTTPS & Ingress Master Toggle */}
            <div className="divide-y divide-border border border-border rounded-xl bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Lock className="size-3.5 text-primary" />
                    <Label className="text-xs font-semibold text-foreground">Automatic HTTPS Redirection</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Redirect all inbound plain HTTP requests on port {httpPort} to secure HTTPS port {httpsPort}.
                  </p>
                </div>
                <Switch
                  checked={forceHttps}
                  onCheckedChange={setForceHttps}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Radio className="size-3.5 text-primary" />
                    <Label className="text-xs font-semibold text-foreground">Enable Traefik Ingress on Node</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Accept external container proxy traffic on this server. Disable if this node is compute-only.
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>
          </div>

          {/* ACME & Let's Encrypt Automation */}
          <div className="space-y-4 pt-2">
            <div className="font-semibold text-sm text-foreground flex items-center gap-2 border-b border-border pb-2">
              <ShieldCheck className="size-4 text-primary" />
              <span>Let&apos;s Encrypt & ACME Automation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">ACME Registration Email</Label>
                <Input
                  type="email"
                  value={acmeEmail}
                  onChange={(e) => setAcmeEmail(e.target.value)}
                  placeholder="admin@gettako.dev"
                  disabled={updateMutation.isPending}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Contact address for TLS certificate expiry alerts and Let&apos;s Encrypt notices.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Dynamic Routing Config Directory</Label>
                <div className="flex items-center gap-2">
                  <FolderTree className="size-4 text-muted-foreground shrink-0" />
                  <Input
                    value={dynamicConfigDir}
                    onChange={(e) => setDynamicConfigDir(e.target.value)}
                    placeholder="/etc/tako/traefik/dynamic"
                    disabled={updateMutation.isPending}
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Filesystem mount watched by Traefik for dynamic YAML route definitions.
                </p>
              </div>
            </div>
          </div>

          {/* Observability & Dashboard */}
          <div className="space-y-4 pt-2">
            <div className="font-semibold text-sm text-foreground flex items-center gap-2 border-b border-border pb-2">
              <ExternalLink className="size-4 text-primary" />
              <span>Traefik Dashboard & Telemetry</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Traefik Web Dashboard</Label>
                    <Switch
                      checked={dashboardEnabled}
                      onCheckedChange={setDashboardEnabled}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Expose Traefik internal UI for live router, middleware, and service introspection.
                  </p>
                </div>

                {dashboardEnabled && (
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <Label className="text-[11px] font-medium text-muted-foreground">Dashboard Port</Label>
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      value={dashboardPort}
                      onChange={(e) => setDashboardPort(parseInt(e.target.value) || 8080)}
                      className="font-mono text-xs h-8"
                    />
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Prometheus Metrics Exporter</Label>
                    <Switch
                      checked={metricsEnabled}
                      onCheckedChange={setMetricsEnabled}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Emit real-time HTTP request count, latencies, and error codes for cluster monitoring.
                  </p>
                </div>

                <div className="text-[11px] text-muted-foreground font-mono pt-2 border-t border-border">
                  Endpoint: :{metricsEnabled ? '8080/metrics' : 'disabled'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="px-0 pt-6 pb-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Configuration changes are applied dynamically without dropping active TCP connections.
          </p>

          <Button
            type="submit"
            size="default"
            disabled={updateMutation.isPending}
            className="text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 active:not-aria-[haspopup]:translate-y-px"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save Traefik Settings
              </>
            )}
          </Button>
        </CardFooter>
      </form>
      )}
    </Card>
  );
}
