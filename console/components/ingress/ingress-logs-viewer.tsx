'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Globe,
  Radio,
  RefreshCw,
  Search,
  Filter,
  Server,
  Box,
  Clock,
  Download,
  Pause,
  Play,
  Copy,
  Check,
  Eye,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  ArrowUpDown,
  FileCode,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIngressAccessLogs } from '@/lib/queries/use-ingress';
import { useNodes, useServices } from '@/lib/queries';
import { TraefikAccessLogEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function IngressLogsViewer() {
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [pollInterval, setPollInterval] = useState<number>(3000);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [selectedLog, setSelectedLog] = useState<TraefikAccessLogEntry | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Queries
  const { data: nodes = [] } = useNodes();
  const { data: services = [] } = useServices();

  const rateOptions = useMemo(
    () => [
      { value: '1000', label: '1s (Fast)' },
      { value: '3000', label: '3s (Default)' },
      { value: '5000', label: '5s (Normal)' },
      { value: '10000', label: '10s (Eco)' },
    ],
    []
  );

  const nodeOptions = useMemo(
    () => [
      { value: 'all', label: 'All Nodes (Global Cluster)' },
      ...nodes.map((node) => ({
        value: node.id,
        label: `${node.name} (${node.ipAddress || node.publicIp || 'node'})`,
      })),
    ],
    [nodes]
  );

  const serviceOptions = useMemo(
    () => [
      { value: 'all', label: 'All Services' },
      ...services.map((service) => ({
        value: service.id,
        label: `${service.name} (${service.slug})`,
      })),
    ],
    [services]
  );

  const methodOptions = useMemo(
    () => [
      { value: 'all', label: 'All Methods' },
      { value: 'GET', label: 'GET' },
      { value: 'POST', label: 'POST' },
      { value: 'PUT', label: 'PUT' },
      { value: 'DELETE', label: 'DELETE' },
      { value: 'PATCH', label: 'PATCH' },
      { value: 'OPTIONS', label: 'OPTIONS' },
      { value: 'HEAD', label: 'HEAD' },
    ],
    []
  );

  const queryFilters = useMemo(
    () => ({
      nodeId: selectedNode === 'all' ? undefined : selectedNode,
      serviceId: selectedService === 'all' ? undefined : selectedService,
      status: selectedStatus === 'all' ? undefined : selectedStatus,
      method: selectedMethod === 'all' ? undefined : selectedMethod,
      search: search.trim() || undefined,
      limit: 150,
    }),
    [selectedNode, selectedService, selectedStatus, selectedMethod, search]
  );

  const {
    data: logs = [],
    isLoading,
    isFetching,
    refetch,
  } = useIngressAccessLogs(queryFilters, {
    refetchInterval: isLive ? pollInterval : false,
  });

  // Calculate high-level real-time metrics
  const stats = useMemo(() => {
    const total = logs.length;
    if (total === 0) {
      return { total: 0, errorRate: 0, avgDuration: 0, status2xx: 0, status5xx: 0 };
    }
    const errors = logs.filter((l) => l.statusCode >= 400).length;
    const status5xx = logs.filter((l) => l.statusCode >= 500).length;
    const status2xx = logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length;
    const totalDuration = logs.reduce((acc, curr) => acc + (curr.durationMs || 0), 0);
    const avgDuration = total > 0 ? (totalDuration / total).toFixed(1) : '0';
    const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : '0';

    return {
      total,
      errorRate: Number(errorRate),
      avgDuration: Number(avgDuration),
      status2xx,
      status5xx,
    };
  }, [logs]);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleResetFilters = () => {
    setSelectedNode('all');
    setSelectedService('all');
    setSelectedMethod('all');
    setSelectedStatus('all');
    setSearch('');
    toast.info('Filters reset to default');
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `traefik-ingress-logs-${new Date().toISOString().slice(0, 19)}.json`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
    toast.success(`Exported ${logs.length} ingress access log entries (JSON)`);
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Node', 'Status', 'Method', 'Host', 'Path', 'Service', 'Router', 'ClientIP', 'DurationMs'];
    const rows = logs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.nodeName || l.nodeId || ''}"`,
      l.statusCode,
      `"${l.method}"`,
      `"${l.host || ''}"`,
      `"${l.path}"`,
      `"${l.serviceName || ''}"`,
      `"${l.routerName || ''}"`,
      `"${l.clientIp}"`,
      l.durationMs,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const dl = document.createElement('a');
    dl.setAttribute('href', encodeURI(csvContent));
    dl.setAttribute('download', `traefik-ingress-logs-${new Date().toISOString().slice(0, 19)}.csv`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
    toast.success(`Exported ${logs.length} ingress access log entries (CSV)`);
  };

  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
          {code}
        </span>
      );
    }
    if (code >= 300 && code < 400) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/15 text-blue-500 border border-blue-500/30">
          {code}
        </span>
      );
    }
    if (code >= 400 && code < 500) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
          {code}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30">
        {code}
      </span>
    );
  };

  const getMethodBadge = (method: string) => {
    const m = (method || 'GET').toUpperCase();
    const colors: Record<string, string> = {
      GET: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
      POST: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
      PUT: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
      PATCH: 'text-purple-400 bg-purple-500/10 border-purple-500/25',
      DELETE: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
      OPTIONS: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/25',
      HEAD: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
    };
    return (
      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border', colors[m] || 'text-muted-foreground bg-muted/40 border-border')}>
        {m}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Real-time Ingress Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card/60 backdrop-blur-xs p-3">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Total Requests</span>
            <Globe className="size-3.5 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono mt-1 text-foreground">
            {stats.total.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Buffer: last {logs.length} entries
          </div>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-xs p-3">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Error Rate</span>
            <AlertCircle className={cn('size-3.5', stats.errorRate > 5 ? 'text-rose-500' : 'text-emerald-500')} />
          </div>
          <div className={cn('text-2xl font-bold font-mono mt-1', stats.errorRate > 5 ? 'text-rose-500' : 'text-foreground')}>
            {stats.errorRate}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.status5xx} server errors (5xx)
          </div>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-xs p-3">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Avg Ingress Latency</span>
            <Clock className="size-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono mt-1 text-foreground">
            {stats.avgDuration} <span className="text-xs text-muted-foreground font-sans font-normal">ms</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Reverse-proxy duration
          </div>
        </Card>

        <Card className="border-border bg-card/60 backdrop-blur-xs p-3">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Scope Filter</span>
            <Layers className="size-3.5 text-primary" />
          </div>
          <div className="text-base font-semibold truncate mt-1 text-foreground">
            {selectedNode === 'all' ? 'All Nodes' : nodes.find((n) => n.id === selectedNode)?.name || selectedNode}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {selectedService === 'all' ? 'All Services' : services.find((s) => s.id === selectedService)?.name || selectedService}
          </div>
        </Card>
      </div>

      {/* Main Controls Card */}
      <Card className="border-border bg-card p-4 space-y-4">
        {/* Top Control Bar: Streaming Status & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border/80">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Streaming Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLive(!isLive)}
              className={cn(
                'h-8 text-xs gap-1.5 border-border font-medium transition-all',
                isLive ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'text-muted-foreground'
              )}
            >
              <Radio className={cn('size-3.5', isLive ? 'animate-pulse text-emerald-400' : 'text-muted-foreground')} />
              <span>{isLive ? 'LIVE STREAMING' : 'STREAM PAUSED'}</span>
            </Button>

            {/* Polling Interval Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Rate:</span>
              <Select
                value={String(pollInterval)}
                onValueChange={(val) => {
                  if (val) setPollInterval(Number(val));
                }}
                items={rateOptions}
                disabled={!isLive}
              >
                <SelectTrigger size="sm" className="h-8 w-32 text-xs bg-muted/30 border-border">
                  <SelectValue placeholder="Rate">
                    {(val) => rateOptions.find((r) => r.value === val)?.label || `${val}ms`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} align="start">
                  {rateOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manual Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 text-xs gap-1.5 border-border"
              title="Manual Refresh"
            >
              <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Export Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
              disabled={logs.length === 0}
              className="h-8 text-xs gap-1.5 border-border"
            >
              <FileCode className="size-3.5" />
              <span>JSON</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="h-8 text-xs gap-1.5 border-border"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>CSV</span>
            </Button>

            {(selectedNode !== 'all' || selectedService !== 'all' || selectedMethod !== 'all' || selectedStatus !== 'all' || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Node Filter */}
          <div className="lg:col-span-3">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Filter by Node
            </label>
            <Select
              value={selectedNode}
              onValueChange={(val) => setSelectedNode(val ?? 'all')}
              items={nodeOptions}
            >
              <SelectTrigger size="sm" className="h-8 text-xs bg-muted/40 border-border">
                <div className="flex items-center gap-1.5 truncate">
                  <Server className="size-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Nodes">
                    {(val) => nodeOptions.find((n) => n.value === val)?.label || 'All Nodes'}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start" className="w-(--anchor-width) max-h-60">
                {nodeOptions.map((node) => (
                  <SelectItem key={node.value} value={node.value}>
                    {node.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Filter */}
          <div className="lg:col-span-3">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Filter by Service
            </label>
            <Select
              value={selectedService}
              onValueChange={(val) => setSelectedService(val ?? 'all')}
              items={serviceOptions}
            >
              <SelectTrigger size="sm" className="h-8 text-xs bg-muted/40 border-border">
                <div className="flex items-center gap-1.5 truncate">
                  <Box className="size-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Services">
                    {(val) => serviceOptions.find((s) => s.value === val)?.label || 'All Services'}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start" className="w-(--anchor-width) max-h-60">
                {serviceOptions.map((service) => (
                  <SelectItem key={service.value} value={service.value}>
                    {service.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Method Filter */}
          <div className="lg:col-span-2">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              HTTP Method
            </label>
            <Select
              value={selectedMethod}
              onValueChange={(val) => setSelectedMethod(val ?? 'all')}
              items={methodOptions}
            >
              <SelectTrigger size="sm" className="h-8 text-xs bg-muted/40 border-border font-mono">
                <SelectValue placeholder="All Methods">
                  {(val) => methodOptions.find((m) => m.value === val)?.label || 'All Methods'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start">
                {methodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="font-mono text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Box */}
          <div className="lg:col-span-4">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Search Request Path / IP / Host / Router
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. /api/v1/auth, 192.168, secure@file..."
                className="h-8 pl-8 text-xs font-mono border-border bg-muted/40"
              />
            </div>
          </div>
        </div>

        {/* HTTP Status Chips */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium mr-1 flex items-center gap-1">
            <Filter className="size-3 text-primary" /> Status:
          </span>
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs select-none">
            {[
              { id: 'all', label: 'All Statuses' },
              { id: '2xx', label: '2xx (OK)' },
              { id: '3xx', label: '3xx (Redirect)' },
              { id: '4xx', label: '4xx (Client Error)' },
              { id: '5xx', label: '5xx (Server Error)' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedStatus(chip.id)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                  selectedStatus === chip.id
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="ml-auto text-xs text-muted-foreground">
            Showing <strong className="text-foreground font-mono">{logs.length}</strong> access entries
          </div>
        </div>
      </Card>

      {/* Access Logs Stream Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-sans">
              <tr>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">TIMESTAMP</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">NODE</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">METHOD</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">STATUS</th>
                <th className="py-2.5 px-3 font-medium">HOST / PATH</th>
                <th className="py-2.5 px-3 font-medium">SERVICE / ROUTER</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">CLIENT IP</th>
                <th className="py-2.5 px-3 font-medium whitespace-nowrap">DURATION</th>
                <th className="py-2.5 px-3 font-medium text-right">DETAILS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground font-sans text-sm">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
                    Connecting to Traefik ingress stream...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground font-sans text-sm">
                    <Globe className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-medium text-foreground">No Traefik ingress logs found</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      No reverse-proxy requests matched the current filter criteria (Node: {selectedNode}, Service: {selectedService}, Status: {selectedStatus}).
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetFilters}
                      className="mt-3 text-xs"
                    >
                      Clear Filters
                    </Button>
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr
                    key={`${log.timestamp}-${idx}-${log.clientIp}`}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-muted/20 transition-colors cursor-pointer group"
                  >
                    {/* Timestamp */}
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString(undefined, {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    {/* Node */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted/60 text-muted-foreground border border-border/80">
                        <Server className="size-2.5" />
                        <span className="truncate max-w-[90px]">{log.nodeName || log.nodeId || 'master'}</span>
                      </span>
                    </td>

                    {/* Method */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {getMethodBadge(log.method)}
                    </td>

                    {/* Status */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {getStatusBadge(log.statusCode)}
                    </td>

                    {/* Host & Path */}
                    <td className="py-2 px-3 max-w-[280px]">
                      <div className="flex flex-col truncate">
                        {log.host && (
                          <span className="text-[10px] text-muted-foreground font-sans truncate">
                            {log.host}
                          </span>
                        )}
                        <span className="text-foreground font-semibold truncate" title={log.path}>
                          {log.path}
                        </span>
                      </div>
                    </td>

                    {/* Service & Router */}
                    <td className="py-2 px-3 max-w-[200px]">
                      <div className="flex flex-col truncate">
                        <span className="text-foreground font-medium truncate" title={log.serviceName}>
                          {log.serviceName || '—'}
                        </span>
                        <span className="text-[10px] text-primary/80 truncate" title={log.routerName}>
                          {log.routerName}
                        </span>
                      </div>
                    </td>

                    {/* Client IP */}
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {log.clientIp}
                    </td>

                    {/* Duration */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'font-mono',
                          log.durationMs > 200
                            ? 'text-rose-400 font-semibold'
                            : log.durationMs > 50
                            ? 'text-amber-400'
                            : 'text-muted-foreground'
                        )}
                      >
                        {log.durationMs.toFixed(1)}ms
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-2 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground group-hover:text-foreground opacity-60 group-hover:opacity-100"
                        title="Inspect Log Entry"
                      >
                        <Eye className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Dialog / Inspector */}
      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-3xl w-[96vw] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl">
          {selectedLog && (
            <>
              {/* Modal Fixed Header */}
              <div className="p-5 pb-3 border-b border-border bg-muted/20 shrink-0 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap pr-8">
                  {getMethodBadge(selectedLog.method)}
                  {getStatusBadge(selectedLog.statusCode)}
                  <span className="font-mono text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted/60 border border-border/80">
                    {selectedLog.durationMs.toFixed(2)} ms
                  </span>
                  <span className="font-mono text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted/60 border border-border/80">
                    {selectedLog.protocol || 'HTTP/1.1'}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border">
                  <span className="font-mono text-xs text-foreground truncate select-all" title={selectedLog.host ? `https://${selectedLog.host}${selectedLog.path}` : selectedLog.path}>
                    <span className="text-muted-foreground">{selectedLog.host ? `https://${selectedLog.host}` : ''}</span>
                    <strong className="text-primary">{selectedLog.path}</strong>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyText(selectedLog.host ? `https://${selectedLog.host}${selectedLog.path}` : selectedLog.path, 'url')}
                    className="h-6 px-2 text-[11px] gap-1 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {copiedKey === 'url' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedKey === 'url' ? 'Copied' : 'Copy URL'}</span>
                  </Button>
                </div>
              </div>

              {/* Modal Scrollable Body (Zero Clipping) */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Section 1: Ingress Routing & Identity */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="size-3.5 text-primary" />
                    <span>Routing & Gateway Telemetry</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
                      <span className="text-muted-foreground font-sans text-[11px]">Client IP</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{selectedLog.clientIp}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(selectedLog.clientIp, 'ip')}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Copy IP"
                        >
                          {copiedKey === 'ip' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
                      <span className="text-muted-foreground font-sans text-[11px]">Ingress Node</span>
                      <span className="font-semibold text-foreground truncate max-w-[180px]">
                        {selectedLog.nodeName || selectedLog.nodeId || 'master-node'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
                      <span className="text-muted-foreground font-sans text-[11px]">Traefik Router</span>
                      <span className="font-semibold text-primary truncate max-w-[180px]" title={selectedLog.routerName}>
                        {selectedLog.routerName || '—'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
                      <span className="text-muted-foreground font-sans text-[11px]">Target Service</span>
                      <span className="font-semibold text-foreground truncate max-w-[180px]">
                        {selectedLog.serviceName || '—'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
                      <span className="text-muted-foreground font-sans text-[11px]">Host Header</span>
                      <span className="font-semibold text-foreground truncate max-w-[180px]" title={selectedLog.host}>
                        {selectedLog.host || '—'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
                      <span className="text-muted-foreground font-sans text-[11px]">Ingress Latency</span>
                      <span className="font-semibold text-emerald-400">
                        {selectedLog.durationMs.toFixed(2)} ms
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Client User-Agent Header */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                      Client User-Agent
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(selectedLog.userAgent || '', 'ua')}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {copiedKey === 'ua' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      <span>Copy User-Agent</span>
                    </button>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs font-mono break-words leading-relaxed text-foreground select-all">
                    {selectedLog.userAgent || 'No User-Agent header recorded'}
                  </div>
                </div>

                {/* Section 3: Full Raw JSON Telemetry */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                      Complete Traefik JSON Telemetry
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyText(selectedLog.rawJson || JSON.stringify(selectedLog, null, 2), 'json')}
                      className="h-7 text-xs gap-1.5 border-border cursor-pointer"
                    >
                      {copiedKey === 'json' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      <span>{copiedKey === 'json' ? 'Copied' : 'Copy Raw JSON'}</span>
                    </Button>
                  </div>
                  <div className="relative rounded-lg border border-border overflow-hidden bg-black/80">
                    <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed select-all">
                      {selectedLog.rawJson
                        ? (() => {
                            try {
                              return JSON.stringify(JSON.parse(selectedLog.rawJson), null, 2);
                            } catch {
                              return selectedLog.rawJson;
                            }
                          })()
                        : JSON.stringify(selectedLog, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Modal Fixed Footer */}
              <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
                <span className="text-xs font-mono text-muted-foreground">
                  Timestamp UTC: {selectedLog.timestamp}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLog(null)}
                  className="h-8 text-xs cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
