'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react';
import { DeploymentStepName, StepStatus } from '@/lib/types';
import { LogLine } from '@/components/ui/log-viewer';
import { cn } from '@/lib/utils';

export interface BuildLogSectionProps {
  stepName: DeploymentStepName;
  status: StepStatus;
  logs: LogLine[];
  durationMs?: number;
  initiallyExpanded?: boolean;
}

export function BuildLogSection({
  stepName,
  status,
  logs,
  durationMs,
  initiallyExpanded,
}: BuildLogSectionProps) {
  // If running or failed, default to expanded; otherwise default to collapsed
  const [expanded, setExpanded] = useState(
    initiallyExpanded ?? (status === 'running' || status === 'failed')
  );

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="size-3.5 text-[#98A4F7] animate-spin" />;
      case 'success':
        return <CheckCircle2 className="size-3.5 text-emerald-400" />;
      case 'failed':
        return <XCircle className="size-3.5 text-[#FF5A6A]" />;
      default:
        return <Clock className="size-3.5 text-[#939DB8]" />;
    }
  };

  return (
    <div
      id={`log-step-${stepName.replace(/[^a-zA-Z0-9]/g, '-')}`}
      className="border-b border-border last:border-b-0"
    >
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-left font-mono text-xs transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          {getStatusIcon()}
          <span className="font-semibold text-foreground">Phase: {stepName}</span>
          <span className="text-muted-foreground text-[11px]">({logs.length} lines)</span>
        </div>

        {durationMs && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {(durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </button>

      {/* Log lines body */}
      {expanded && (
        <div className="px-6 py-2 space-y-0.5 bg-muted/20 font-mono text-xs text-muted-foreground border-t border-border/40">
          {logs.length === 0 ? (
            <div className="py-2 italic text-muted-foreground/50">Waiting for logs...</div>
          ) : (
            logs.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-baseline gap-3 py-0.5 px-1 rounded-xs hover:bg-muted/50 text-foreground/80',
                  line.level === 'error' && 'text-destructive bg-destructive/10 font-semibold',
                  line.level === 'warn' && 'text-amber-600 dark:text-amber-300'
                )}
              >
                <span className="w-8 shrink-0 select-none text-right text-[11px] text-muted-foreground/40 font-mono">
                  {idx + 1}
                </span>
                <span className="break-all whitespace-pre-wrap">{line.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
