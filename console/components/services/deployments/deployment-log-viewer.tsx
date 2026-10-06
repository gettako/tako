'use client';

import React, { useState } from 'react';
import { Search, Copy, Check, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuildLogSection } from './build-log-section';
import { Deployment, DeploymentStepName, StepStatus } from '@/lib/types';
import { getMockBuildLogs } from '@/lib/mock/log-streamer';

export interface DeploymentLogViewerProps {
  deployment: Deployment;
  serviceName: string;
}

export function DeploymentLogViewer({ deployment, serviceName }: DeploymentLogViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);

  const mockGroups = getMockBuildLogs(serviceName, deployment.commitHash);

  // Merge with deployment.steps
  const sections = mockGroups.map((group) => {
    const stepMeta = deployment.steps.find((s) => s.name === group.stepName);
    const status: StepStatus = stepMeta?.status || (deployment.status === 'live' ? 'success' : 'pending');

    // Filter logs if search query exists
    const filteredLogs = searchQuery
      ? group.logs.filter((l) => l.message.toLowerCase().includes(searchQuery.toLowerCase()))
      : group.logs;

    return {
      stepName: group.stepName,
      status,
      logs: filteredLogs,
      durationMs: stepMeta?.durationMs,
    };
  });

  const handleCopyAll = async () => {
    const allLines = sections
      .flatMap((s) => [`--- [${s.stepName}] ---`, ...s.logs.map((l) => l.message)])
      .join('\n');
    await navigator.clipboard.writeText(allLines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border bg-background text-foreground font-mono text-[13px] overflow-hidden shadow-sm">
      {/* Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Build Pipeline Output</span>
          <span className="text-[11px] text-muted-foreground font-mono">
            commit {deployment.commitHash.substring(0, 7)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="absolute left-2 size-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search build logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-36 sm:w-48 rounded border border-border bg-background pl-6 pr-2 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:border-primary"
            />
          </div>

          {/* Follow toggle */}
          <button
            type="button"
            onClick={() => setAutoFollow(!autoFollow)}
            className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] font-medium transition-colors ${
              autoFollow
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowDown className="size-3" />
            <span>Follow</span>
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopyAll}
            className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Sections Container */}
      <div className="divide-y divide-border/60 max-h-[560px] overflow-y-auto bg-background">
        {sections.map((section) => (
          <BuildLogSection
            key={section.stepName}
            stepName={section.stepName}
            status={section.status}
            logs={section.logs}
            durationMs={section.durationMs}
          />
        ))}
      </div>
    </div>
  );
}
