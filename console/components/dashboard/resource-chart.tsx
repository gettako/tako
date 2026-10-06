'use client';

import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { MetricPoint } from '@/lib/api/metrics';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ResourceChartProps {
  title: string;
  data: MetricPoint[];
  dataKey: keyof MetricPoint;
  color?: string;
  colorVar?: string;
  unit: string;
  currentValue: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  averageValue?: string | number;
  peakValue?: string | number;
}

const defaultSeriesTokens: Record<string, string> = {
  cpu: 'var(--chart-cpu)',
  memory: 'var(--chart-ram)',
  networkRx: 'var(--chart-network)',
  networkTx: 'var(--chart-network)',
  disk: 'var(--chart-disk)',
};

export function ResourceChart({
  title,
  data,
  dataKey,
  color,
  colorVar,
  unit,
  currentValue,
  subtitle,
  icon: Icon,
}: ResourceChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartColor = colorVar || color || defaultSeriesTokens[String(dataKey)] || 'var(--primary)';

  const chartConfig = {
    [dataKey]: {
      label: title,
      color: chartColor,
    },
  };

  const formattedData = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  return (
    <Card className="rounded-xl border border-border bg-card transition-colors overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground shrink-0">
                <Icon className="size-4 sm:size-5" />
              </div>
            )}
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
                {title}
              </CardTitle>
              {subtitle && (
                <CardDescription className="text-xs text-muted-foreground truncate mt-0.5">
                  {subtitle}
                </CardDescription>
              )}
            </div>
          </div>

          <div className="flex items-baseline gap-1 font-mono text-right shrink-0">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {currentValue}
            </span>
            <span className="text-xs text-muted-foreground">{unit}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {!mounted ? (
          <div className="h-44 w-full animate-pulse rounded-md bg-muted/30" />
        ) : (
          <ChartContainer config={chartConfig} className="h-44 w-full aspect-auto">
            <AreaChart
              data={formattedData}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`fill-${String(dataKey)}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeOpacity={0.35}
                strokeDasharray="3 3"
              />

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
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-muted-foreground font-mono"
              />

              <ChartTooltip
                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                content={
                  <ChartTooltipContent
                    className="font-mono text-xs"
                    formatter={(val) => [`${val} ${unit}`, title]}
                  />
                }
              />

              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={chartColor}
                strokeWidth={2}
                fill={`url(#fill-${String(dataKey)})`}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
