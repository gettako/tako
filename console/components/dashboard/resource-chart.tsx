'use client';

import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartCard,
  ChartCardHeader,
  ChartCardContent,
} from '@/components/ui/chart';
import { MetricPoint } from '@/lib/queries';
import { type LucideIcon } from 'lucide-react';
import {
  ChartTimeRange,
  normalizeChartTimeSeries,
} from '@/lib/utils/chart-time';

export interface ResourceChartProps {
  title: string;
  data: MetricPoint[];
  dataKey: keyof MetricPoint;
  color?: string;
  colorVar?: string;
  unit: string;
  currentValue: string | number;
  subtitle?: string;
  timeRange?: ChartTimeRange;
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
  timeRange = '1h',
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

  const formattedData = React.useMemo(() => {
    return normalizeChartTimeSeries(data, timeRange, [dataKey]);
  }, [data, timeRange, dataKey]);

  return (
    <ChartCard>
      <ChartCardHeader
        icon={Icon}
        title={title}
        description={subtitle}
        actionLayout="inline"
        action={
          <div className="flex items-baseline gap-1 font-mono text-right shrink-0">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {currentValue}
            </span>
            <span className="text-xs text-muted-foreground">{unit}</span>
          </div>
        }
      />

      <ChartCardContent isLoading={!mounted} skeletonHeight="h-44">
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
              minTickGap={24}
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
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipTime || ''}
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
      </ChartCardContent>
    </ChartCard>
  );
}
