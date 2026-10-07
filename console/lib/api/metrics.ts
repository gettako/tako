import { simulateDelay } from './delay';

export interface MetricPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  networkRx: number;
  networkTx: number;
  disk: number;
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
        if (Array.isArray(data) && data.length > 0) {
          return data;
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
