'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '@/lib/api/audit';
import { AuditFilters, AuditCategory } from '@/components/audit/audit-filters';
import { AuditTable } from '@/components/audit/audit-table';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { History } from 'lucide-react';

export default function AuditLogsPage() {
  const [category, setCategory] = useState<AuditCategory>('all');
  const [search, setSearch] = useState('');
  const [selectedActor, setSelectedActor] = useState('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: getAuditLogs,
  });

  // Extract unique actors for filter dropdown
  const actorsMap: Record<string, { id: string; name: string }> = {};
  logs.forEach((l) => {
    actorsMap[l.actor.id] = { id: l.actor.id, name: l.actor.name };
  });
  const uniqueActors = Object.values(actorsMap);

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

  return (
    <>
      <title>Security Audit Logs — Takō Cloud</title>
      <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Security Audit Logs
        </h1>
        <p className="text-base text-muted-foreground mt-1">
          Immutable event ledger tracking administrative operations, deployments, role adjustments, and logins.
        </p>
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
