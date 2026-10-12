import { useState, useMemo } from 'react';
import { useIngressAccessLogs } from '@/lib/queries/use-ingress';
import { useNodes, useServices } from '@/lib/queries';
import { TraefikAccessLogEntry } from '@/lib/types';
import { toast } from 'sonner';

export type StatusTab = 'all' | '2xx' | '3xx' | '4xx' | '5xx';

export interface IngressLogsFilterOptions {
  initialPollInterval?: number;
}

export function useIngressLogsFilter(options: IngressLogsFilterOptions = {}) {
  const { initialPollInterval = 3000 } = options;

  const [selectedNode, setSelectedNode] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedStatusTab, setSelectedStatusTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState<string>('');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [pollInterval, setPollInterval] = useState<number>(initialPollInterval);
  const [selectedLog, setSelectedLog] = useState<TraefikAccessLogEntry | null>(null);

  // Queries
  const { data: nodes = [] } = useNodes();
  const { data: services = [] } = useServices();

  const rateOptions = useMemo(
    () => [
      { value: '1000', label: '1s' },
      { value: '3000', label: '3s' },
      { value: '5000', label: '5s' },
      { value: '10000', label: '10' },
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

  return {
    selectedNode,
    setSelectedNode,
    selectedService,
    setSelectedService,
    selectedMethod,
    setSelectedMethod,
    selectedStatusTab,
    setSelectedStatusTab,
    search,
    setSearch,
    isLive,
    setIsLive,
    pollInterval,
    setPollInterval,
    selectedLog,
    setSelectedLog,
    logs,
    isLoading,
    isFetching,
    refetch,
    stats,
    hasActiveFilters,
    rateOptions,
    nodeOptions,
    serviceOptions,
    methodOptions,
    handleResetFilters,
    handleExportJSON,
    handleExportCSV,
  };
}
