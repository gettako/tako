'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, Server, Activity, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { DashboardChartsGrid } from '@/components/dashboard/dashboard-charts-grid';
import { NodeSummaryWidget } from '@/components/dashboard/node-summary-widget';
import { RecentDeploymentsWidget } from '@/components/dashboard/recent-deployments-widget';
import {
  useProjects,
  useServices,
  useNodes,
  useDeployments,
  useTimeSeriesMetrics,
} from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { useNodeEvents } from '@/hooks/use-node-events';

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  // Subscribe to live node events via SSE (metrics & status changes)
  useNodeEvents();

  useEffect(() => {
    const handleOpen = () => setIsCreateProjectOpen(true);
    window.addEventListener('open-create-project-dialog', handleOpen);
    return () => window.removeEventListener('open-create-project-dialog', handleOpen);
  }, []);

  const {
    data: projects,
    isLoading: loadingProjects,
    error: errorProjects,
    refetch: refetchProjects,
  } = useProjects({ refetchInterval: 30000 });

  const {
    data: services,
    isLoading: loadingServices,
    error: errorServices,
    refetch: refetchServices,
  } = useServices(undefined, { refetchInterval: 15000 });

  const {
    data: nodes,
    isLoading: loadingNodes,
    error: errorNodes,
    refetch: refetchNodes,
  } = useNodes({ refetchInterval: 10000 });

  const {
    data: deployments,
    isLoading: loadingDeployments,
    error: errorDeployments,
    refetch: refetchDeployments,
  } = useDeployments(undefined, { refetchInterval: 15000 });

  const {
    data: metrics,
    isLoading: loadingMetrics,
    error: errorMetrics,
    refetch: refetchMetrics,
  } = useTimeSeriesMetrics('cluster', timeRange, { refetchInterval: 15000 });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchProjects(),
      refetchServices(),
      refetchNodes(),
      refetchDeployments(),
      refetchMetrics(),
    ]);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 450);
  };

  const isLoading =
    loadingProjects || loadingServices || loadingNodes || loadingDeployments || loadingMetrics;
  const hasError = errorProjects || errorServices || errorNodes || errorDeployments;

  if (hasError) {
    return (
      <>
        <title>Cluster Overview — Takō Cloud</title>
        <ErrorState
          title="Failed to load dashboard data"
          description="There was an issue fetching the latest cluster metrics and workloads."
          retry={() => handleRefresh()}
        />
      </>
    );
  }

  if (isLoading || !projects || !services || !nodes || !deployments || !metrics) {
    return (
      <>
        <title>Cluster Overview — Takō Cloud</title>
        <div className="space-y-8 animate-pulse">
          {/* Header Banner Skeleton */}
          <div className="rounded-2xl border border-border bg-muted/20 p-6 sm:p-8 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="h-8 w-56 rounded-lg bg-muted/60" />
                <div className="h-4 w-80 rounded-md bg-muted/40" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-24 rounded-md bg-muted/50" />
                <div className="h-9 w-28 rounded-md bg-muted/60" />
              </div>
            </div>
          </div>

          {/* 4 Stat Cards Skeleton */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 rounded bg-muted/50" />
                  <div className="size-8 rounded-lg bg-muted/40" />
                </div>
                <div className="h-8 w-20 rounded bg-muted/60" />
                <div className="h-3 w-32 rounded bg-muted/40" />
              </div>
            ))}
          </div>

          {/* Telemetry Charts & Bottom Widgets Skeleton */}
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-6 w-44 rounded bg-muted/60" />
                  <div className="h-4 w-64 rounded bg-muted/40" />
                </div>
                <div className="h-7 w-32 rounded-lg bg-muted/40" />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-muted/50" />
                        <div className="space-y-1">
                          <div className="h-4 w-28 rounded bg-muted/60" />
                          <div className="h-3 w-40 rounded bg-muted/40" />
                        </div>
                      </div>
                      <div className="h-7 w-16 rounded bg-muted/50" />
                    </div>
                    <div className="h-44 w-full rounded-lg bg-muted/20" />
                  </div>
                ))}
              </div>
            </div>

            {/* 2 Bottom Widgets Skeleton */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-muted/50" />
                      <div className="h-5 w-36 rounded bg-muted/60" />
                    </div>
                    <div className="h-4 w-20 rounded bg-muted/40" />
                  </div>
                  <div className="space-y-3 pt-2">
                    <div className="h-10 w-full rounded bg-muted/20" />
                    <div className="h-10 w-full rounded bg-muted/20" />
                    <div className="h-10 w-full rounded bg-muted/20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (projects.length === 0 && nodes.length === 0) {
    return (
      <>
        <title>Cluster Overview — Takō Cloud</title>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
                Cluster Overview
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Realtime telemetry, workload health, and node distribution
              </p>
            </div>
            <Button
              onClick={() => setIsCreateProjectOpen(true)}
              size="sm"
              className="gap-1.5 text-xs sm:text-sm h-9 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 active:not-aria-[haspopup]:translate-y-px cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>New Project</span>
            </Button>
          </div>

          <EmptyState
            icon={Server}
            title="No cluster resources found"
            description="Your Tako cluster currently has no projects or server nodes provisioned. Connect a node or initialize a project to start deploying containers."
            action={{
              label: 'Create First Project',
              onClick: () => setIsCreateProjectOpen(true),
              icon: Plus,
            }}
          />

          <CreateProjectDialog
            open={isCreateProjectOpen}
            onOpenChange={setIsCreateProjectOpen}
          />
        </div>
      </>
    );
  }

  const healthyServices = services.filter((s) => s.status === 'healthy').length;
  const totalServices = services.length;
  const isAllHealthy = totalServices > 0 && healthyServices === totalServices;

  return (
    <>
      <title>Cluster Overview — Takō Cloud</title>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
                Cluster Overview
              </h1>
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  totalServices === 0
                    ? 'border-border bg-muted/40 text-muted-foreground'
                    : isAllHealthy
                    ? 'border-status-success/30 bg-status-success/10 text-status-success'
                    : 'border-status-warning/30 bg-status-warning/10 text-status-warning'
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    totalServices === 0
                      ? 'bg-muted-foreground/60'
                      : isAllHealthy
                      ? 'bg-status-success animate-pulse'
                      : 'bg-status-warning'
                  )}
                />
                <span>
                  {totalServices === 0
                    ? 'No Active Workloads'
                    : isAllHealthy
                    ? 'All Systems Operational'
                    : `${totalServices - healthyServices} Workload${
                        totalServices - healthyServices === 1 ? '' : 's'
                      } Degraded`}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Realtime cluster telemetry, workload health status, and node orchestration.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-1.5 text-xs sm:text-sm h-9 px-3 active:not-aria-[haspopup]:translate-y-px cursor-pointer"
            >
              <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>

            <Button
              onClick={() => setIsCreateProjectOpen(true)}
              size="sm"
              className="gap-1.5 text-xs sm:text-sm h-9 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 active:not-aria-[haspopup]:translate-y-px cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>New Project</span>
            </Button>
          </div>
        </div>

        {/* Cluster High-Level Stats */}
        <DashboardStats projects={projects} services={services} nodes={nodes} />

        {/* Telemetry Charts & Infrastructure Widgets */}
        <div className="space-y-6">
          <DashboardChartsGrid
            metrics={metrics}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />

          {/* Node Summary & Recent Deployments */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <NodeSummaryWidget nodes={nodes} />
            <RecentDeploymentsWidget deployments={deployments} />
          </div>
        </div>

        {/* Create Project Modal Form */}
        <CreateProjectDialog
          open={isCreateProjectOpen}
          onOpenChange={setIsCreateProjectOpen}
        />
      </div>
    </>
  );
}
