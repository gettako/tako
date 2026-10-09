const simulateDelay = (minMs = 100, maxMs = 250): Promise<void> => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export interface MetricPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  networkRx: number;
  networkTx: number;
  disk: number;
}

export type TimeRange = '15m' | '1h' | '6h' | '24h' | '7d';

export interface ServiceMetricPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
  diskRead: number;
  diskWrite: number;
  replicaMetrics?: Record<string, { cpu: number; memory: number }>;
}

export async function getTimeSeriesMetrics(
  entityId: string,
  timeRange: '1h' | '6h' | '24h' | '7d' = '1h'
): Promise<MetricPoint[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/metrics?nodeId=${encodeURIComponent(entityId)}&range=${encodeURIComponent(timeRange)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((d: any) => ({
            timestamp: d.timestamp || new Date().toISOString(),
            cpu: typeof d.cpu === 'number' ? d.cpu : 0,
            memory: d.memoryPercent !== undefined
              ? Number(d.memoryPercent)
              : (d.memory > 100 ? Math.min(100, Math.round(d.memory / 81.92)) : Number(d.memory) || 0),
            networkRx: typeof d.networkRx === 'number' ? d.networkRx : 0,
            networkTx: typeof d.networkTx === 'number' ? d.networkTx : 0,
            disk: d.diskPercent !== undefined
              ? Number(d.diskPercent)
              : (d.disk > 100 ? Math.min(100, Math.round(d.disk / 1.0)) : Number(d.disk) || 0),
          }));
        }
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  const count = timeRange === '1h' ? 12 : timeRange === '6h' ? 24 : 30;
  const now = Date.now();
  const stepMs = (timeRange === '1h' ? 3600000 : 86400000) / count;

  const points: MetricPoint[] = [];
  for (let i = count; i >= 0; i--) {
    const t = new Date(now - i * stepMs).toISOString();
    const seed = (now - i * stepMs) % 100;
    points.push({
      timestamp: t,
      cpu: Math.min(100, Math.max(10, Math.round(25 + Math.sin(i / 2) * 15 + (seed % 10)))),
      memory: Math.min(100, Math.max(20, Math.round(45 + Math.cos(i / 3) * 12 + (seed % 8)))),
      networkRx: Math.round(300 + Math.sin(i) * 150 + seed * 2),
      networkTx: Math.round(600 + Math.cos(i) * 250 + seed * 4),
      disk: Math.round(40 + (i / count) * 5),
    });
  }

  return points;
}

export async function getServiceTimeSeriesMetrics(
  serviceId: string,
  timeRange: TimeRange = '1h',
  baseline?: {
    cpuPercent?: number;
    memoryUsedMb?: number;
    memoryLimitMb?: number;
    replicas?: number;
  }
): Promise<ServiceMetricPoint[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(
        `/api/services/${encodeURIComponent(serviceId)}/metrics?range=${encodeURIComponent(timeRange)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay(60);

  const durationMap: Record<TimeRange, number> = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };

  const countMap: Record<TimeRange, number> = {
    '15m': 15,
    '1h': 24,
    '6h': 36,
    '24h': 48,
    '7d': 42,
  };

  const totalDuration = durationMap[timeRange] || 3600000;
  const count = countMap[timeRange] || 24;
  const stepMs = totalDuration / count;
  const now = Date.now();

  const baseCpu = baseline?.cpuPercent !== undefined ? Math.max(3, baseline.cpuPercent) : 12;
  const baseMem = baseline?.memoryUsedMb !== undefined ? Math.max(16, baseline.memoryUsedMb) : 140;
  const memLimit = baseline?.memoryLimitMb || 1024;
  const replicaCount = Math.max(1, baseline?.replicas || 1);

  const points: ServiceMetricPoint[] = [];

  for (let i = count; i >= 0; i--) {
    const pointTime = now - i * stepMs;
    const t = new Date(pointTime).toISOString();
    const wave = Math.sin(i / 3) * 0.35 + Math.cos(i / 1.5) * 0.15;
    const jitter = ((pointTime % 100) - 50) / 100;

    const cpuVal = Math.min(100, Math.max(2, Math.round(baseCpu + baseCpu * wave + jitter * 4)));
    const memVal = Math.max(16, Math.min(memLimit, Math.round(baseMem + baseMem * 0.15 * wave + jitter * 8)));
    const memPct = Math.min(100, Math.round((memVal / Math.max(1, memLimit)) * 100));

    const rx = Math.max(10, Math.round(120 + Math.sin(i / 2) * 80 + Math.abs(jitter) * 60));
    const tx = Math.max(25, Math.round(350 + Math.cos(i / 2) * 180 + Math.abs(jitter) * 110));
    const dRead = Math.max(2, Math.round(18 + Math.sin(i) * 12 + jitter * 4));
    const dWrite = Math.max(1, Math.round(12 + Math.cos(i) * 8 + jitter * 3));

    const replicaMetrics: Record<string, { cpu: number; memory: number }> = {};
    if (replicaCount > 1) {
      for (let r = 1; r <= replicaCount; r++) {
        const rFactor = 1 + (r % 2 === 0 ? 0.08 : -0.06);
        replicaMetrics[`replica-${r}`] = {
          cpu: Math.min(100, Math.max(1, Math.round(cpuVal * rFactor))),
          memory: Math.round(memVal * rFactor),
        };
      }
    }

    points.push({
      timestamp: t,
      cpu: cpuVal,
      memory: memVal,
      memoryPercent: memPct,
      networkRx: rx,
      networkTx: tx,
      diskRead: dRead,
      diskWrite: dWrite,
      replicaMetrics: replicaCount > 1 ? replicaMetrics : undefined,
    });
  }

  return points;
}

