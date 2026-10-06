'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '@/lib/api/audit';
import { AuditFilters, AuditCategory } from '@/components/audit/audit-filters';
import { AuditTable } from '@/components/audit/audit-table';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { History, ShieldCheck, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function AuditLogsPage() {
  const [category, setCategory] = useState<AuditCategory>('all');
  const [search, setSearch] = useState('');
  const [selectedActor, setSelectedActor] = useState('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: getAuditLogs,
  });

  // Extract unique actors for filter dropdown
  const actorsMap: Record<string, { id: string; name: string; email?: string; avatarUrl?: string }> = {};
  logs.forEach((l) => {
    actorsMap[l.actor.id] = {
      id: l.actor.id,
      name: l.actor.name,
      email: l.actor.email,
      avatarUrl: l.actor.avatarUrl,
    };
  });
  const uniqueActors = Object.values(actorsMap);

  const categoryCounts = React.useMemo(() => {
    return {
      all: logs.length,
      auth: logs.filter((l) => l.action.startsWith('auth.') || l.targetType === 'user').length,
      project: logs.filter((l) => l.targetType === 'project').length,
      service: logs.filter((l) => l.targetType === 'service').length,
      node: logs.filter((l) => l.targetType === 'node').length,
      settings: logs.filter((l) => l.targetType === 'settings').length,
    };
  }, [logs]);

  const handleResetFilters = () => {
    setCategory('all');
    setSearch('');
    setSelectedActor('all');
  };

  const filteredLogs = logs.filter((log) => {
    // 1. Category filter
    if (category !== 'all') {
      if (category === 'auth') {
        const isAuthAction = log.action.startsWith('auth.');
        const isUserTarget = log.targetType === 'user';
        if (!isAuthAction && !isUserTarget) return false;
      } else if (log.targetType !== category) {
        return false;
      }
    }

    // 2. Actor filter
    if (selectedActor !== 'all' && log.actor.name !== selectedActor) {
      return false;
    }

    // 3. Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchAction = log.action.toLowerCase().includes(q);
      const matchTarget = log.targetName.toLowerCase().includes(q);
      const matchActor = log.actor.name.toLowerCase().includes(q);
      const matchIp = log.ipAddress.toLowerCase().includes(q);
      if (!matchAction && !matchTarget && !matchActor && !matchIp) return false;
    }

    return true;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit-logs-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success(`Exported ${filteredLogs.length} audit event records`);
  };

  return (
    <>
      <title>Security Audit Logs — Takō Cloud</title>
      <div className="space-y-8">
        {/* Page Header (Base Vega Gradient Hero) */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-primary/5 via-background to-background p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
                  Security Audit Logs
                </h1>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  <ShieldCheck className="size-3.5 text-primary" />
                  Immutable Audit Ledger
                </span>
              </div>

              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-normal">
                Cryptographically tracked ledger of administrative actions, deployments, and security events.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                disabled={filteredLogs.length === 0}
                className="gap-1.5 text-xs sm:text-sm h-9 px-3.5 bg-card border-border/70 active:not-aria-[haspopup]:translate-y-px shrink-0 cursor-pointer shadow-xs"
              >
                <Download className="size-3.5" />
                <span>Export Ledger JSON</span>
              </Button>
            </div>
          </div>
        </div>

      {/* Filter Controls (AC-1) */}
      <AuditFilters
        category={category}
        onCategoryChange={setCategory}
        search={search}
        onSearchChange={setSearch}
        selectedActor={selectedActor}
        onActorChange={setSelectedActor}
        actors={uniqueActors}
        counts={categoryCounts}
        onReset={handleResetFilters}
      />

      {/* Table & Skeletons */}
      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No audit events found"
          description={
            search || category !== 'all' || selectedActor !== 'all'
              ? 'No security events match the current filter criteria.'
              : 'No audit records in the event log.'
          }
          action={
            search || category !== 'all' || selectedActor !== 'all'
              ? {
                  label: 'Clear Filters',
                  onClick: () => {
                    setCategory('all');
                    setSearch('');
                    setSelectedActor('all');
                  },
                }
              : undefined
          }
        />
      ) : (
        <AuditTable logs={filteredLogs} pageSize={8} />
      )}
    </div>
  </>
);
}
