'use client';

import React from 'react';
import { ResourceChart } from '@/components/dashboard/resource-chart';
import { MetricPoint } from '@/lib/api/metrics';
import { Activity, Cpu, Network, HardDrive } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';

interface NodeMetricsChartsProps {
  metrics: MetricPoint[];
  nodeName: string;
}

export function NodeMetricsCharts({ metrics, nodeName }: NodeMetricsChartsProps) {
  const latest = metrics[metrics.length - 1] || {
    cpu: 24,
    memory: 45,
    networkRx: 420,
    networkTx: 890,
    disk: 40,
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Activity}
        title="Host Telemetry & Metrics"
        description={`Real-time resource utilization for ${nodeName} (sampled over the last hour)`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CPU Chart (indigo-500) */}
        <ResourceChart
          title="CPU Utilization"
          subtitle="Host processor activity"
          data={metrics}
          dataKey="cpu"
          color="#6366f1"
          unit="%"
          currentValue={latest.cpu}
          icon={Cpu}
        />

        {/* Memory Chart (emerald-500) */}
        <ResourceChart
          title="RAM Memory Usage"
          subtitle="Physical host memory allocation"
          data={metrics}
          dataKey="memory"
          color="#10b981"
          unit="%"
          currentValue={latest.memory}
          icon={Activity}
        />

        {/* Disk I/O Chart (amber-500) */}
        <ResourceChart
          title="Disk Storage & I/O"
          subtitle="Block storage allocation & throughput"
          data={metrics}
          dataKey="disk"
          color="#f59e0b"
          unit="%"
          currentValue={latest.disk}
          icon={HardDrive}
        />

        {/* Network Traffic Chart (blue-500) */}
        <ResourceChart
          title="Network Ingress (Rx)"
          subtitle="Inbound Ethernet bandwidth"
          data={metrics}
          dataKey="networkRx"
          color="#3b82f6"
          unit="KB/s"
          currentValue={latest.networkRx}
          icon={Network}
        />
      </div>
    </div>
  );
}
