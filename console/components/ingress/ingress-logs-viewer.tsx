'use client';

import React, { useState, useMemo } from 'react';
import {
  Globe,
  Radio,
  RefreshCw,
  Search,
  Server,
  Box,
  Clock,
  Download,
  Copy,
  Check,
  Eye,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
  X,
  FileCode,
  FileSpreadsheet,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { IngressLogDetailSheet } from './ingress-log-detail-sheet';
import { useIngressAccessLogs } from '@/lib/queries/use-ingress';
import { useNodes, useServices } from '@/lib/queries';
import { TraefikAccessLogEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type StatusTab = 'all' | '2xx' | '3xx' | '4xx' | '5xx';

export function IngressLogsViewer() {
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedStatusTab, setSelectedStatusTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState<string>('');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [pollInterval, setPollInterval] = useState<number>(3000);
  const [selectedLog, setSelectedLog] = useState<TraefikAccessLogEntry | null>(null);

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
      { value: 'all', label: 'All Cluster Nodes' },
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
      status: selectedStatusTab === 'all' ? undefined : selectedStatusTab,
      method: selectedMethod === 'all' ? undefined : selectedMethod,
      search: search.trim() || undefined,
      limit: 150,
    }),
    [selectedNode, selectedService, selectedStatusTab, selectedMethod, search]
  );

  const {
    data: logs = [],
    isLoading,
    isFetching,
    refetch,
  } = useIngressAccessLogs(queryFilters, {
    refetchInterval: isLive ? pollInterval : false,
  });

  // Real-time calculated metrics
  const stats = useMemo(() => {
    const total = logs.length;
    if (total === 0) {
      return { total: 0, errorRate: 0, successRate: 100, avgDuration: 0, status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0 };
    }
    const status2xx = logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length;
    const status3xx = logs.filter((l) => l.statusCode >= 300 && l.statusCode < 400).length;
    const status4xx = logs.filter((l) => l.statusCode >= 400 && l.statusCode < 500).length;
    const status5xx = logs.filter((l) => l.statusCode >= 500).length;
    const errors = status4xx + status5xx;
    const totalDuration = logs.reduce((acc, curr) => acc + (curr.durationMs || 0), 0);
    const avgDuration = total > 0 ? (totalDuration / total).toFixed(1) : '0';
    const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : '0';
    const successRate = total > 0 ? ((status2xx / total) * 100).toFixed(1) : '100';

    return {
      total,
      errorRate: Number(errorRate),
      successRate: Number(successRate),
      avgDuration: Number(avgDuration),
      status2xx,
      status3xx,
      status4xx,
      status5xx,
    };
  }, [logs]);

  const hasActiveFilters =
    selectedNode !== 'all' ||
    selectedService !== 'all' ||
    selectedMethod !== 'all' ||
    selectedStatusTab !== 'all' ||
    search.trim() !== '';

  const handleResetFilters = () => {
    setSelectedNode('all');
    setSelectedService('all');
    setSelectedMethod('all');
    setSelectedStatusTab('all');
    setSearch('');
    toast.info('Filters reset to default');
  };

  const handleExportJSON = () => {
    if (logs.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `traefik-ingress-logs-${new Date().toISOString().slice(0, 19)}.json`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
    toast.success(`Exported ${logs.length} ingress log records (JSON)`);
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
    toast.success(`Exported ${logs.length} ingress log records (CSV)`);
  };

  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30">
          {code}
        </span>
      );
    }
    if (code >= 300 && code < 400) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-blue-500/10 text-blue-700 dark:bg-[#98A4F7]/15 dark:text-[#98A4F7] border border-blue-500/20 dark:border-[#98A4F7]/30">
          {code}
        </span>
      );
    }
    if (code >= 400 && code < 500) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/25">
          {code}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-red-500/10 text-red-700 dark:bg-[#FF5A6A]/15 dark:text-[#FF5A6A] border border-red-500/20 dark:border-[#FF5A6A]/30">
        {code}
      </span>
    );
  };

  const getMethodBadge = (method: string) => {
    const m = (method || 'GET').toUpperCase();
    const colors: Record<string, string> = {
      GET: 'text-blue-600 dark:text-[#98A4F7] border-blue-500/30 bg-blue-500/10',
      POST: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      PUT: 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10',
      PATCH: 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10',
      DELETE: 'text-red-600 dark:text-[#FF5A6A] border-red-500/30 bg-red-500/10',
      OPTIONS: 'text-muted-foreground border-border bg-muted/40',
      HEAD: 'text-muted-foreground border-border bg-muted/40',
    };
    return (
      <span
        className={cn(
          'inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-mono font-semibold border',
          colors[m] || 'text-muted-foreground border-border bg-muted/40'
        )}
      >
        {m}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Real-time Ingress Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Requests"
          value={stats.total.toLocaleString()}
          subtext={`Buffer: last ${logs.length} captured entries`}
          icon={Globe}
        />

        <StatCard
          title="Success Rate"
          value={`${stats.successRate}%`}
          subtext={`${stats.status2xx} OK responses (2xx)`}
          icon={CheckCircle2}
          statusAccent="healthy"
        />

        <StatCard
          title="Error Rate"
          value={`${stats.errorRate}%`}
          subtext={`${stats.status5xx} server errors (5xx)`}
          icon={AlertCircle}
          statusAccent={stats.errorRate > 5 ? 'error' : undefined}
        />

        <StatCard
          title="Avg Latency"
          value={`${stats.avgDuration} ms`}
          subtext="Edge proxy dispatch time"
          icon={Clock}
        />
      </div>

      {/* 2. Unified Streaming & Filter Card */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-4">
        {/* Top Control Bar: Streaming Status, Rate & Global Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Streaming Toggle */}
            <Button
              variant={isLive ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => setIsLive(!isLive)}
              className={cn(
                'h-9 text-xs gap-2 font-medium active:not-aria-[haspopup]:translate-y-px cursor-pointer',
                isLive
                  ? 'border-status-success/40 bg-status-success/10 text-status-success hover:bg-status-success/15'
                  : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  isLive ? 'bg-status-success animate-pulse' : 'bg-muted-foreground'
                )}
              />
              <span>{isLive ? 'Live Stream Active' : 'Stream Paused'}</span>
            </Button>

            {/* Polling Interval Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Poll:</span>
              <Select
                value={String(pollInterval)}
                onValueChange={(val) => {
                  if (val) setPollInterval(Number(val));
                }}
                disabled={!isLive}
                items={rateOptions}
              >
                <SelectTrigger size="sm" className="h-9 w-32 text-xs bg-card border-border cursor-pointer">
                  <SelectValue placeholder="Poll Interval">
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
              className="h-9 text-xs gap-1.5 border-border active:not-aria-[haspopup]:translate-y-px cursor-pointer"
              title="Refresh ingress logs"
            >
              <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logs.length === 0}
                    className="h-9 text-xs gap-1.5 border-border active:not-aria-[haspopup]:translate-y-px cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    <span>Export</span>
                    <ChevronDown className="size-3 opacity-60" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleExportJSON} className="gap-2 text-xs cursor-pointer">
                  <FileCode className="size-3.5 text-muted-foreground" />
                  <span>Export as JSON</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="gap-2 text-xs cursor-pointer">
                  <FileSpreadsheet className="size-3.5 text-muted-foreground" />
                  <span>Export as CSV</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Reset Filters Action */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 text-xs gap-1.5 text-muted-foreground hover:text-foreground active:not-aria-[haspopup]:translate-y-px cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Status Tabs Bar (Base Vega specification via Tabs) */}
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <Tabs
            value={selectedStatusTab}
            onValueChange={(val) => setSelectedStatusTab(val as StatusTab)}
            className="w-full"
          >
            <TabsList className="h-9 p-1 bg-muted/60 dark:bg-muted/30 border border-border rounded-lg gap-1 min-w-max justify-start">
              {[
                { id: 'all', label: 'All Requests', count: logs.length },
                { id: '2xx', label: '2xx Success', count: stats.status2xx },
                { id: '3xx', label: '3xx Redirect', count: stats.status3xx },
                { id: '4xx', label: '4xx Client Error', count: stats.status4xx },
                { id: '5xx', label: '5xx Server Error', count: stats.status5xx },
              ].map((tab) => {
                const isSelected = selectedStatusTab === tab.id;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={cn(
                      'h-7 px-3 text-xs font-medium rounded-md gap-1.5 transition-all select-none cursor-pointer',
                      'active:not-aria-[haspopup]:translate-y-px',
                      'data-active:bg-background data-active:text-foreground data-active:border data-active:border-border',
                      'dark:data-active:bg-card dark:data-active:text-foreground dark:data-active:border-border'
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        'ml-1 text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-full transition-colors',
                        isSelected
                          ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#98A4F7]'
                          : 'bg-muted-foreground/15 text-muted-foreground'
                      )}
                    >
                      {tab.count}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
          {/* Search Box */}
          <div className="lg:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search request path, client IP, host, router..."
              className="pl-9 pr-8 text-xs sm:text-sm h-9 bg-card border-border rounded-md placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 font-mono"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-sm transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Node Filter */}
          <div className="lg:col-span-3">
            <Select
              value={selectedNode}
              onValueChange={(val) => setSelectedNode(val ?? 'all')}
              items={nodeOptions}
            >
              <SelectTrigger size="sm" className="h-9 text-xs sm:text-sm bg-card border-border cursor-pointer">
                <div className="flex items-center gap-2 truncate">
                  <Server className="size-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Cluster Nodes">
                    {(val) => nodeOptions.find((n) => n.value === val)?.label || 'All Nodes'}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start" className="w-(--anchor-width) max-h-60">
                {nodeOptions.map((node) => (
                  <SelectItem key={node.value} value={node.value} className="text-xs">
                    {node.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Filter */}
          <div className="lg:col-span-2">
            <Select
              value={selectedService}
              onValueChange={(val) => setSelectedService(val ?? 'all')}
              items={serviceOptions}
            >
              <SelectTrigger size="sm" className="h-9 text-xs sm:text-sm bg-card border-border cursor-pointer">
                <div className="flex items-center gap-2 truncate">
                  <Box className="size-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Services">
                    {(val) => serviceOptions.find((s) => s.value === val)?.label || 'All Services'}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start" className="w-(--anchor-width) max-h-60">
                {serviceOptions.map((service) => (
                  <SelectItem key={service.value} value={service.value} className="text-xs">
                    {service.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Method Filter */}
          <div className="lg:col-span-2">
            <Select
              value={selectedMethod}
              onValueChange={(val) => setSelectedMethod(val ?? 'all')}
              items={methodOptions}
            >
              <SelectTrigger size="sm" className="h-9 text-xs sm:text-sm bg-card border-border cursor-pointer font-mono">
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
        </div>
      </div>

      {/* 3. Ingress Access Logs Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading && logs.length === 0 ? (
          <div className="p-6">
            <LoadingSkeleton variant="table" />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No ingress access logs found"
            description={
              hasActiveFilters
                ? 'No reverse-proxy requests matched your current filter criteria.'
                : 'No access logs have been received from Traefik ingress yet.'
            }
            action={
              hasActiveFilters
                ? {
                    label: 'Clear Filters',
                    onClick: handleResetFilters,
                  }
                : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader className="bg-muted/40 border-b border-border">
                <TableRow className="h-10 hover:bg-transparent">
                  <TableHead className="w-[12%]">Timestamp</TableHead>
                  <TableHead className="w-[8%]">Status</TableHead>
                  <TableHead className="w-[9%]">Method</TableHead>
                  <TableHead className="w-[28%]">Host & Path</TableHead>
                  <TableHead className="w-[17%]">Service / Router</TableHead>
                  <TableHead className="w-[12%]">Node</TableHead>
                  <TableHead className="w-[11%]">Client IP</TableHead>
                  <TableHead className="w-[8%]">Latency</TableHead>
                  <TableHead className="w-[5%] text-right pr-4">Details</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-border/40">
                {logs.map((log, idx) => (
                  <TableRow
                    key={`${log.timestamp}-${idx}-${log.clientIp}`}
                    onClick={() => setSelectedLog(log)}
                    className="h-14 hover:bg-muted/30 transition-colors group cursor-pointer active:not-aria-[haspopup]:translate-y-px"
                  >
                    {/* Timestamp */}
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      <div className="font-medium text-foreground">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                      <div className="text-[10px] text-muted-foreground/80">
                        {new Date(log.timestamp).toLocaleDateString([], {
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </div>
                    </TableCell>

                    {/* Status Code */}
                    <TableCell className="whitespace-nowrap">
                      {getStatusBadge(log.statusCode)}
                    </TableCell>

                    {/* HTTP Method */}
                    <TableCell className="whitespace-nowrap">
                      {getMethodBadge(log.method)}
                    </TableCell>

                    {/* Host & Path */}
                    <TableCell className="max-w-[280px]">
                      <div className="flex flex-col truncate">
                        {log.host && (
                          <span className="text-[11px] text-muted-foreground truncate" title={log.host}>
                            {log.host}
                          </span>
                        )}
                        <span className="font-mono text-xs font-semibold text-foreground truncate" title={log.path}>
                          {log.path}
                        </span>
                      </div>
                    </TableCell>

                    {/* Target Service & Router */}
                    <TableCell className="max-w-[190px]">
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-medium text-foreground truncate" title={log.serviceName}>
                          {log.serviceName || '—'}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground truncate" title={log.routerName}>
                          {log.routerName || '—'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Node */}
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono bg-muted/60 text-muted-foreground border border-border">
                        <Server className="size-3 shrink-0" />
                        <span className="truncate max-w-[90px]">{log.nodeName || log.nodeId || 'master'}</span>
                      </span>
                    </TableCell>

                    {/* Client IP */}
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {log.clientIp}
                    </TableCell>

                    {/* Latency / Duration */}
                    <TableCell className="whitespace-nowrap">
                      <span
                        className={cn(
                          'font-mono text-xs',
                          log.durationMs > 200
                            ? 'text-status-danger font-medium'
                            : log.durationMs > 50
                            ? 'text-status-warning'
                            : 'text-muted-foreground'
                        )}
                      >
                        {log.durationMs.toFixed(1)} ms
                      </span>
                    </TableCell>

                    {/* Action Inspector Button */}
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground group-hover:text-foreground opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="View log details"
                      >
                        <Eye className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Table Footer Summary */}
            <div className="p-3.5 px-4 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  Showing <strong className="text-foreground font-mono">{logs.length}</strong> access entries
                </span>
                {hasActiveFilters && (
                  <Badge variant="outline" className="text-[10px] h-5 border-border bg-muted/40">
                    Filtered
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
                <span>Buffer limit: 150 events</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 4. Log Detail Slide-over Inspector Sheet */}
      <IngressLogDetailSheet
        open={Boolean(selectedLog)}
        onOpenChange={(open) => !open && setSelectedLog(null)}
        log={selectedLog}
      />
    </div>
  );
}
