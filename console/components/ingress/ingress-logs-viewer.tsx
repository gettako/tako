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
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 border border-border px-2.5 py-1 rounded-md">
              <span>Rate:</span>
              <select
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                className="bg-transparent text-foreground font-medium text-xs focus:outline-hidden cursor-pointer"
                disabled={!isLive}
              >
                <option value={1000} className="bg-popover text-popover-foreground">1s</option>
                <option value={3000} className="bg-popover text-popover-foreground">3s (Default)</option>
                <option value={5000} className="bg-popover text-popover-foreground">5s</option>
                <option value={10000} className="bg-popover text-popover-foreground">10s</option>
              </select>
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
            <div className="relative">
              <Server className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md bg-muted/40 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all" className="bg-popover text-popover-foreground">All Nodes (Global Cluster)</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id} className="bg-popover text-popover-foreground">
                    {node.name} ({node.ipAddress || node.publicIp || 'node'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Service Filter */}
          <div className="lg:col-span-3">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Filter by Service
            </label>
            <div className="relative">
              <Box className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md bg-muted/40 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all" className="bg-popover text-popover-foreground">All Services</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id} className="bg-popover text-popover-foreground">
                    {service.name} ({service.slug})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Method Filter */}
          <div className="lg:col-span-2">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              HTTP Method
            </label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full h-8 px-2.5 text-xs rounded-md bg-muted/40 border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer font-mono"
            >
              <option value="all" className="bg-popover text-popover-foreground">All Methods</option>
              <option value="GET" className="bg-popover text-popover-foreground">GET</option>
              <option value="POST" className="bg-popover text-popover-foreground">POST</option>
              <option value="PUT" className="bg-popover text-popover-foreground">PUT</option>
              <option value="DELETE" className="bg-popover text-popover-foreground">DELETE</option>
              <option value="PATCH" className="bg-popover text-popover-foreground">PATCH</option>
              <option value="OPTIONS" className="bg-popover text-popover-foreground">OPTIONS</option>
              <option value="HEAD" className="bg-popover text-popover-foreground">HEAD</option>
            </select>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto font-sans">
          {selectedLog && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  {getMethodBadge(selectedLog.method)}
                  {getStatusBadge(selectedLog.statusCode)}
                  <span className="font-mono text-xs text-muted-foreground">
                    {selectedLog.durationMs.toFixed(2)}ms
                  </span>
                </div>
                <DialogTitle className="font-mono text-sm break-all font-semibold text-foreground">
                  {selectedLog.host ? `https://${selectedLog.host}${selectedLog.path}` : selectedLog.path}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Recorded at {new Date(selectedLog.timestamp).toUTCString()} ({selectedLog.protocol || 'HTTP/2.0'})
                </DialogDescription>
              </DialogHeader>

              {/* Grid of Attributes */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-lg border border-border font-mono">
                <div>
                  <span className="text-muted-foreground font-sans block text-[11px]">Client IP</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-semibold text-foreground">{selectedLog.clientIp}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(selectedLog.clientIp, 'ip')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedKey === 'ip' ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground font-sans block text-[11px]">Traefik Router</span>
                  <span className="font-semibold text-primary mt-0.5 block truncate" title={selectedLog.routerName}>
                    {selectedLog.routerName || '—'}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground font-sans block text-[11px]">Target Service</span>
                  <span className="font-semibold text-foreground mt-0.5 block truncate">
                    {selectedLog.serviceName || '—'}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground font-sans block text-[11px]">Ingress Node</span>
                  <span className="font-semibold text-foreground mt-0.5 block truncate">
                    {selectedLog.nodeName || selectedLog.nodeId || 'master-node'}
                  </span>
                </div>
              </div>

              {/* User Agent */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium font-sans">User-Agent Header</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(selectedLog.userAgent, 'ua')}
                    className="inline-flex items-center gap-1 text-[11px] hover:text-foreground"
                  >
                    {copiedKey === 'ua' ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
                    <span>Copy User-Agent</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-md bg-muted/40 border border-border text-xs font-mono break-all text-muted-foreground">
                  {selectedLog.userAgent || 'None recorded'}
                </div>
              </div>

              {/* Full Raw JSON */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium font-sans">Raw JSON Telemetry</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(JSON.stringify(selectedLog, null, 2), 'json')}
                    className="inline-flex items-center gap-1 text-[11px] hover:text-foreground"
                  >
                    {copiedKey === 'json' ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
                    <span>Copy JSON</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black/40 border border-border text-[11px] font-mono overflow-x-auto text-foreground/90 max-h-48">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
