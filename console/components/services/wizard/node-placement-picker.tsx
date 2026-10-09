'use client';

import React from 'react';
import { Server, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Node } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface NodePlacementPickerProps {
  nodes: Node[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  disabled?: boolean;
  nodeError?: string;
}

export function NodePlacementPicker({
  nodes,
  selectedNodeId,
  onSelectNode,
  disabled = false,
  nodeError,
}: NodePlacementPickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Server className="size-3 text-primary" />
          Target Compute Node
        </span>
        <span className="text-[11px] text-muted-foreground">Select cluster placement</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isOffline = node.status === 'offline';
          const isDegraded = node.status === 'degraded';

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode(node.id)}
              disabled={isOffline || disabled}
              className={cn(
                'relative flex flex-col p-3.5 rounded-xl border text-left transition-all cursor-pointer active:not-aria-[haspopup]:translate-y-px outline-none',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                  : 'border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground',
                isOffline && 'opacity-60 cursor-not-allowed bg-muted/20 hover:bg-muted/20'
              )}
            >
              {/* Header Row: Radio Indicator + Node Name + Status Badge */}
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      'size-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background'
                    )}
                  >
                    {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                  </div>

                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-foreground truncate block">
                      {node.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      node.status === 'online'
                        ? 'bg-status-success'
                        : isDegraded
                        ? 'bg-status-warning'
                        : 'bg-status-danger'
                    )}
                  />
                  <span className="text-[10px] font-medium capitalize text-muted-foreground">
                    {node.status}
                  </span>
                </div>
              </div>

              {/* Specs & Hardware Row */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                <span className="bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                  {node.cpuTotalCores} vCPU
                </span>
                <span className="bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                  {(node.memoryTotalMb / 1024) % 1 === 0
                    ? `${(node.memoryTotalMb / 1024).toFixed(0)} GiB RAM`
                    : `${(node.memoryTotalMb / 1024).toFixed(2)} GiB RAM`}
                </span>
                <span className="bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                  {node.ipAddress}
                </span>
              </div>

              {/* Usage & Telemetry Stats */}
              <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Activity className="size-3 text-primary" />
                  <span>Load:</span>
                  <span className="font-mono font-medium text-foreground">
                    {node.usage.cpuPercent}% CPU
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono uppercase">
                  {node.role || 'worker'}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      {nodeError && (
        <p className="text-xs font-medium text-status-danger mt-1">{nodeError}</p>
      )}
    </div>
  );
}
