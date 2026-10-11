'use client';

import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Radio, Filter, ArrowUpRight, Clock, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TraefikAccessLogEntry } from '@/lib/types';
import { getNodeTraefikAccessLogs } from '@/lib/api/nodes';
import { cn } from '@/lib/utils';

interface NodeTraefikAccessLogsProps {
  nodeId: string;
}

export function NodeTraefikAccessLogs({ nodeId }: NodeTraefikAccessLogsProps) {
  const [logs, setLogs] = useState<TraefikAccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    try {
      const data = await getNodeTraefikAccessLogs(nodeId, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load Traefik access logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [nodeId, statusFilter, search]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [nodeId, statusFilter, search, autoRefresh]);

  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          {code}
        </span>
      );
    }
    if (code >= 300 && code < 400) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
          {code}
        </span>
      );
    }
    if (code >= 400 && code < 500) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          {code}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
        {code}
      </span>
    );
  };

  const getMethodBadge = (method: string) => {
    const m = method.toUpperCase();
    const colors: Record<string, string> = {
      GET: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      POST: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      PUT: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      PATCH: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      DELETE: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    };
    return (
      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border', colors[m] || 'text-muted-foreground bg-muted/40 border-border')}>
        {m}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filter and Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {['all', '2xx', '3xx', '4xx', '5xx'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  'px-2.5 py-1 rounded-md capitalize font-medium transition-all select-none',
                  statusFilter === st
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {st === 'all' ? 'All' : st}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter path, router, IP..."
              className="h-8 pl-8 text-xs font-mono border-border"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn('h-8 text-xs gap-1.5 border-border', autoRefresh ? 'text-primary' : 'text-muted-foreground')}
          >
            <Radio className={cn('size-3.5', autoRefresh && 'animate-pulse text-emerald-500')} />
            <span>{autoRefresh ? 'Live Stream' : 'Paused'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="h-8 text-xs gap-1.5 border-border"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Access Logs Stream Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-sans">
              <tr>
                <th className="py-2.5 px-3 font-medium">TIMESTAMP</th>
                <th className="py-2.5 px-3 font-medium">STATUS</th>
                <th className="py-2.5 px-3 font-medium">METHOD</th>
                <th className="py-2.5 px-3 font-medium">PATH</th>
                <th className="py-2.5 px-3 font-medium">DURATION</th>
                <th className="py-2.5 px-3 font-medium">CLIENT IP</th>
                <th className="py-2.5 px-3 font-medium">ROUTER / SERVICE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground font-sans text-sm">
                    No Traefik ingress access logs matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={`${log.timestamp}-${idx}`} className="hover:bg-muted/15 transition-colors">
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3">{getStatusBadge(log.statusCode)}</td>
                    <td className="py-2 px-3">{getMethodBadge(log.method)}</td>
                    <td className="py-2 px-3 text-foreground font-semibold max-w-xs truncate" title={log.path}>
                      {log.path}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {log.durationMs.toFixed(1)}ms
                    </td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {log.clientIp}
                    </td>
                    <td className="py-2 px-3 text-primary truncate max-w-[200px]" title={log.routerName}>
                      {log.routerName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
