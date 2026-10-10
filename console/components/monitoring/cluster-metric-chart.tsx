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
  icon?: LucideIcon;
}

export function ClusterMetricChart({
  title,
  description,
  series,
  metricKey,
  unit,
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

  // Build combined data array
  const baseMetrics = series.find((s) => s.metrics && s.metrics.length > 0)?.metrics || [];
  const chartData = baseMetrics.map((point, index) => {
    const row: Record<string, string | number> = {
      timestamp: point.timestamp,
      time: new Date(point.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    series.forEach((s) => {
      const p = s.metrics?.[index];
      if (p) {
        // If node is offline, show 0
        row[s.node.id] = s.node.status === 'offline' ? 0 : (p[metricKey] ?? 0);
      } else {
        row[s.node.id] = 0;
      }
    });

    return row;
  });

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
