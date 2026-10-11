'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartCard,
  ChartCardHeader,
  ChartCardContent,
} from '@/components/ui/chart';
import { Cpu, Activity, type LucideIcon } from 'lucide-react';
import { Node } from '@/lib/types';
import { MetricPoint } from '@/lib/queries';
import { cn } from '@/lib/utils';
import {
  ChartTimeRange,
  getTimeRangeConfig,
  formatChartTick,
  formatChartTooltip,
} from '@/lib/utils/chart-time';

export interface NodeSeriesData {
  node: Node;
  metrics: MetricPoint[];
  color: string;
  dashPattern?: string;
}

interface ClusterMetricChartProps {
  title: string;
  description: string;
  series: NodeSeriesData[];
  metricKey: 'cpu' | 'memory';
  unit: string;
  timeRange?: ChartTimeRange;
  icon?: LucideIcon;
}

export function ClusterMetricChart({
  title,
  description,
  series,
  metricKey,
  unit,
  timeRange = '1h',
  icon,
}: ClusterMetricChartProps) {
  const [mounted, setMounted] = useState(false);
  const [visibleNodes, setVisibleNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
    setVisibleNodes((prev) => {
      const next = { ...prev };
      series.forEach((s) => {
        if (next[s.node.id] === undefined) {
          next[s.node.id] = true;
        }
      });
      return next;
    });
  }, [series]);

  const toggleNode = (nodeId: string) => {
    setVisibleNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Build uniform time-bucketed data across the full selected time range
  const { durationMs, bucketCount, stepMs } = getTimeRangeConfig(timeRange);

  let now = Date.now();
  series.forEach((s) => {
    if (s.metrics && s.metrics.length > 0) {
      const lastPointTime = new Date(s.metrics[s.metrics.length - 1].timestamp).getTime();
      if (!isNaN(lastPointTime) && lastPointTime > now) {
        now = lastPointTime;
      }
    }
  });

  const startTime = now - durationMs;
  const chartData: Record<string, string | number>[] = [];

  for (let i = 0; i <= bucketCount; i++) {
    const bucketTime = startTime + i * stepMs;
    const bucketWindowStart = bucketTime - stepMs / 2;
    const bucketWindowEnd = bucketTime + stepMs / 2;

    const row: Record<string, string | number> = {
      timestamp: new Date(bucketTime).toISOString(),
      time: formatChartTick(bucketTime, timeRange),
      tooltipTime: formatChartTooltip(bucketTime, timeRange),
    };

    series.forEach((s) => {
      if (s.node.status === 'offline') {
        row[s.node.id] = 0;
        return;
      }

      const nodeMetrics = s.metrics || [];
      const matches = nodeMetrics.filter((p) => {
        const pt = new Date(p.timestamp).getTime();
        return pt >= bucketWindowStart && pt < bucketWindowEnd;
      });

      if (matches.length > 0) {
        const sum = matches.reduce((acc, curr) => acc + (Number(curr[metricKey]) || 0), 0);
        row[s.node.id] = Math.round((sum / matches.length) * 10) / 10;
      } else {
        const earliestTime = nodeMetrics.length > 0 ? new Date(nodeMetrics[0].timestamp).getTime() : 0;
        if (bucketTime < earliestTime - stepMs / 2) {
          // Node had not started recording metrics yet
          row[s.node.id] = 0;
        } else if (nodeMetrics.length > 0) {
          const prev = nodeMetrics
            .filter((p) => new Date(p.timestamp).getTime() <= bucketTime)
            .slice(-1)[0];
          row[s.node.id] = prev ? (prev[metricKey] ?? 0) : 0;
        } else {
          row[s.node.id] = 0;
        }
      }
    });

    chartData.push(row);
  }

  const chartConfig: Record<string, { label: string; color: string }> = {};
  series.forEach((s) => {
    chartConfig[s.node.id] = {
      label: s.node.name,
      color: s.color,
    };
  });

  return (
    <ChartCard>
      <ChartCardHeader
        icon={icon || (metricKey === 'cpu' ? Cpu : Activity)}
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {series.map((s) => {
              const isVisible = visibleNodes[s.node.id] !== false;
              return (
                <button
                  key={s.node.id}
                  type="button"
                  onClick={() => toggleNode(s.node.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-all active:not-aria-[haspopup]:translate-y-px',
                    isVisible
                      ? 'bg-muted/50 border-border text-foreground '
                      : 'opacity-40 line-through bg-transparent border-dashed text-muted-foreground'
                  )}
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.node.name}</span>
                </button>
              );
            })}
          </div>
        }
      />

      <ChartCardContent isLoading={!mounted} skeletonHeight="h-64">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" stroke="var(--border)" strokeOpacity={0.35} />

            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground font-mono"
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground font-mono"
            />

            <ChartTooltip
              cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  className="font-mono text-xs"
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipTime || ''}
                  formatter={(val, name) => {
                    const targetSeries = series.find((s) => s.node.id === name);
                    return [`${val} ${unit}`, targetSeries?.node.name || String(name)];
                  }}
                />
              }
            />

            {series.map((s) => {
              if (visibleNodes[s.node.id] === false) return null;
              return (
                <Line
                  key={s.node.id}
                  type="monotone"
                  dataKey={s.node.id}
                  name={s.node.id}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={s.dashPattern}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              );
            })}
          </LineChart>
        </ChartContainer>
      </ChartCardContent>
    </ChartCard>
  );
}
