export type ChartTimeRange = '15m' | '1h' | '6h' | '24h' | '7d';

export interface TimeRangeConfig {
  durationMs: number;
  bucketCount: number;
  stepMs: number;
}

export function getTimeRangeConfig(range: ChartTimeRange = '1h'): TimeRangeConfig {
  switch (range) {
    case '15m': {
      const durationMs = 15 * 60 * 1000;
      const bucketCount = 15;
      return { durationMs, bucketCount, stepMs: durationMs / bucketCount };
    }
    case '6h': {
      const durationMs = 6 * 60 * 60 * 1000;
      const bucketCount = 24;
      return { durationMs, bucketCount, stepMs: durationMs / bucketCount };
    }
    case '24h': {
      const durationMs = 24 * 60 * 60 * 1000;
      const bucketCount = 24;
      return { durationMs, bucketCount, stepMs: durationMs / bucketCount };
    }
    case '7d': {
      const durationMs = 7 * 24 * 60 * 60 * 1000;
      const bucketCount = 28;
      return { durationMs, bucketCount, stepMs: durationMs / bucketCount };
    }
    case '1h':
    default: {
      const durationMs = 60 * 60 * 1000;
      const bucketCount = 20;
      return { durationMs, bucketCount, stepMs: durationMs / bucketCount };
    }
  }
}

/**
 * Format a timestamp value for XAxis tick labels.
 */
export function formatChartTick(
  timestamp: string | number | Date,
  range: ChartTimeRange = '1h'
): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';

  switch (range) {
    case '15m':
    case '1h':
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    case '6h':
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    case '24h': {
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      // Show short date + time for clear timeline recognition
      return `${dateStr} ${timeStr}`;
    }

    case '7d': {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    default:
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Format full date & time for ChartTooltip header.
 */
export function formatChartTooltip(
  timestamp: string | number | Date,
  range: ChartTimeRange = '1h'
): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';

  const dateStr = d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: range === '15m' ? '2-digit' : undefined,
  });

  return `${dateStr}, ${timeStr}`;
}

/**
 * Normalize an arbitrary time-series array into evenly-spaced buckets covering the selected time window.
 */
export function normalizeChartTimeSeries<T extends { timestamp: string }>(
  rawPoints: T[],
  range: ChartTimeRange = '1h',
  numericKeys: (keyof T)[] = ['cpu', 'memory', 'networkRx', 'networkTx', 'disk'] as (keyof T)[]
): (T & { time: string; formattedTime: string; tooltipTime: string })[] {
  const { durationMs, bucketCount, stepMs } = getTimeRangeConfig(range);

  // Compute anchor timestamps
  let now = Date.now();
  if (rawPoints && rawPoints.length > 0) {
    const lastPointTime = new Date(rawPoints[rawPoints.length - 1].timestamp).getTime();
    if (!isNaN(lastPointTime) && lastPointTime > now) {
      now = lastPointTime;
    }
  }

  const startTime = now - durationMs;

  // Generate bucket slots
  const buckets: (T & { time: string; formattedTime: string; tooltipTime: string })[] = [];

  for (let i = 0; i <= bucketCount; i++) {
    const bucketTime = startTime + i * stepMs;
    const bucketWindowStart = bucketTime - stepMs / 2;
    const bucketWindowEnd = bucketTime + stepMs / 2;

    // Find all raw points within this bucket's window
    const matches = rawPoints.filter((p) => {
      const pt = new Date(p.timestamp).getTime();
      return pt >= bucketWindowStart && pt < bucketWindowEnd;
    });

    const bucketItem: any = {
      timestamp: new Date(bucketTime).toISOString(),
      time: formatChartTick(bucketTime, range),
      formattedTime: formatChartTick(bucketTime, range),
      tooltipTime: formatChartTooltip(bucketTime, range),
    };

    if (matches.length > 0) {
      // Calculate average for numeric keys
      numericKeys.forEach((k) => {
        const sum = matches.reduce((acc, curr) => {
          const val = Number(curr[k]) || 0;
          return acc + val;
        }, 0);
        bucketItem[k] = Math.round((sum / matches.length) * 10) / 10;
      });
    } else {
      // Check if this bucket is before the earliest available metric
      const earliestRawTime = rawPoints.length > 0 ? new Date(rawPoints[0].timestamp).getTime() : 0;
      if (bucketTime < earliestRawTime - stepMs / 2) {
        // Host was inactive/not yet recording before earliest sample
        numericKeys.forEach((k) => {
          bucketItem[k] = 0;
        });
      } else if (rawPoints.length > 0) {
        // Carry forward from closest previous point if gap
        const prev = rawPoints
          .filter((p) => new Date(p.timestamp).getTime() <= bucketTime)
          .slice(-1)[0];
        if (prev) {
          numericKeys.forEach((k) => {
            bucketItem[k] = prev[k] ?? 0;
          });
        } else {
          numericKeys.forEach((k) => {
            bucketItem[k] = 0;
          });
        }
      } else {
        numericKeys.forEach((k) => {
          bucketItem[k] = 0;
        });
      }
    }

    buckets.push(bucketItem);
  }

  return buckets;
}
