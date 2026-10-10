'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Copy, Check, ArrowDown, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuildLogSection } from './build-log-section';
import { Deployment, DeploymentStepName, StepStatus } from '@/lib/types';
import { getDeploymentLogsStreamUrl, subscribeDeploymentLogs } from '@/lib/api/deployments';
import { getMockBuildLogs } from '@/lib/mock/log-streamer';
import { LogLine } from '@/components/ui/log-viewer';

export interface DeploymentLogViewerProps {
  deployment: Deployment;
  serviceName: string;
  onLiveStepUpdate?: (step: DeploymentStepName, status?: string) => void;
}

interface LiveLogChunk {
  step: DeploymentStepName;
  message: string;
  timestamp: string;
  isError?: boolean;
}

export interface DeploymentLogSection {
  stepName: DeploymentStepName;
  status: StepStatus;
  logs: LogLine[];
  durationMs?: number;
}

const ALL_STEPS: DeploymentStepName[] = [
  'Queued',
  'Clone',
  'Build',
  'Push/Load image',
  'Deploy',
  'Health check',
  'Live',
];

const MAX_LIVE_LOGS = 1500;

export function DeploymentLogViewer({
  deployment,
  serviceName,
  onLiveStepUpdate,
}: DeploymentLogViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [liveLogs, setLiveLogs] = useState<LiveLogChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const appendLogs = (chunks: LiveLogChunk[]) => {
    setLiveLogs((prev) => {
      const next = [...prev, ...chunks];
      return next.length > MAX_LIVE_LOGS ? next.slice(next.length - MAX_LIVE_LOGS) : next;
    });
  };

  // Connect to SSE log stream with reconnect handler
  useEffect(() => {
    let mounted = true;
    setIsStreaming(true);

    const unsubscribe = subscribeDeploymentLogs(
      deployment.id,
      (chunk) => {
        if (!mounted) return;

        const rawStep = chunk.step || 'Build';
        const matchedStep: DeploymentStepName =
          ALL_STEPS.find((s) => s.toLowerCase() === rawStep.toLowerCase()) || 'Build';
        onLiveStepUpdate?.(matchedStep, chunk.status);

        let cleanMsg = chunk.message || '';
        const msgMatch = cleanMsg.match(/^(?:\[\d{2}:\d{2}:\d{2}\]\s*)?(?:\[.*?\]\s*)?(.*)$/);
        if (msgMatch && msgMatch[1]) {
          cleanMsg = msgMatch[1].trim();
        }

        appendLogs([
          {
            step: matchedStep,
            message: cleanMsg,
            timestamp: new Date().toISOString(),
            isError: chunk.status === 'failed' || chunk.is_error === true,
          },
        ]);
      },
      {
        onStatusChange: (status, step) => {
          if (!mounted) return;
          if (step) {
            const matched = ALL_STEPS.find((s) => s.toLowerCase() === step.toLowerCase());
            if (matched) onLiveStepUpdate?.(matched, status);
          }
          if (status === 'live' || status === 'failed') {
            setIsStreaming(false);
          }
        },
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [deployment.id]);

  // Auto-scroll when logs change and autoFollow is active
  useEffect(() => {
    if (autoFollow && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [liveLogs, autoFollow]);

  // Handle manual scroll to auto-lock/unlock follow mode
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
    if (!isAtBottom && autoFollow) {
      setAutoFollow(false);
    } else if (isAtBottom && !autoFollow) {
      setAutoFollow(true);
    }
  };

  const toggleFollow = () => {
    const next = !autoFollow;
    setAutoFollow(next);
    if (next && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  // Determine logs source: liveLogs > stored deployment.logs > mock
  const effectiveLogs = useMemo<LiveLogChunk[]>(() => {
    if (liveLogs.length > 0) return liveLogs;
    if (deployment.logs) {
      const rawLines = deployment.logs.split('\n');
      const parsedStored: LiveLogChunk[] = [];
      for (const line of rawLines) {
        if (!line.trim()) continue;
        let step: DeploymentStepName = 'Build';
        let message = line.trim();
        const match = line.match(/^(?:\[\d{2}:\d{2}:\d{2}\]\s*)?(?:\[(.*?)\]\s*)?(.*)$/);
        if (match) {
          if (match[1]) {
            const found = ALL_STEPS.find((s) => s.toLowerCase() === match[1].toLowerCase());
            if (found) step = found;
          } else if (/queue/i.test(line)) {
            step = 'Queued';
          }
          if (match[2]) {
            message = match[2].trim();
          }
        }
        parsedStored.push({
          step,
          message,
          timestamp: deployment.startedAt || new Date().toISOString(),
        });
      }
      if (parsedStored.length > 0) {
        return parsedStored;
      }
    }
    return [];
  }, [liveLogs, deployment.logs, deployment.startedAt]);

  const isDeploymentFinished = deployment.status === 'live';

  // Construct sections - memoized to prevent recomputing across unrelated renders
  const sections = useMemo<DeploymentLogSection[]>(() => {
    if (effectiveLogs.length > 0) {
      // Find the latest step that has logs
      const latestLoggedStepIdx = Math.max(
        -1,
        ...effectiveLogs.map((l) => ALL_STEPS.indexOf(l.step))
      );

      // Group logs by steps
      return ALL_STEPS.map((step, idx) => {
        const stepLogs = effectiveLogs.filter((l) => l.step === step);
        const stepMeta = deployment.steps?.find((s) => s.name === step);
        const hasError = stepLogs.some((l) => l.isError) || stepMeta?.status === 'failed';

        let status: StepStatus = 'pending';

        if (hasError) {
          status = 'failed';
        } else if (isDeploymentFinished) {
          status = stepLogs.length > 0 || (stepMeta && stepMeta.status !== 'pending') ? 'success' : 'pending';
        } else if (stepLogs.length > 0 || (stepMeta && stepMeta.status !== 'pending')) {
          if (idx < latestLoggedStepIdx) {
            status = 'success';
          } else if (idx === latestLoggedStepIdx) {
            if (step === 'Live' || !isStreaming) {
              status = 'success';
            } else {
              status = 'running';
            }
          } else {
            status = 'pending';
          }
        }

        const formattedLogs: LogLine[] = stepLogs.map((l) => ({
          timestamp: l.timestamp,
          message: l.message,
          level: l.isError ? 'error' : 'info',
        }));

        const filteredLogs = searchQuery
          ? formattedLogs.filter((l) => l.message.toLowerCase().includes(searchQuery.toLowerCase()))
          : formattedLogs;

        return {
          stepName: step,
          status,
          logs: filteredLogs,
          durationMs: stepMeta?.durationMs,
        };
      }).filter((s) => s.logs.length > 0 || s.status !== 'pending');
    }

    // Fallback to mock build logs
    const mockGroups = getMockBuildLogs(serviceName, deployment.commitHash);
    return mockGroups.map((group) => {
      const stepMeta = deployment.steps?.find((s) => s.name === group.stepName);
      let status: StepStatus = 'pending';
      if (isDeploymentFinished) {
        status = 'success';
      } else if (stepMeta?.status) {
        status = stepMeta.status;
      } else {
        status = 'pending';
      }

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
  }, [effectiveLogs, deployment.steps, isDeploymentFinished, isStreaming, searchQuery, serviceName, deployment.commitHash]);

  const handleCopyAll = async () => {
    const allLines = sections
      .flatMap((s) => [`--- [${s.stepName}] ---`, ...s.logs.map((l) => l.message)])
      .join('\n');
    await navigator.clipboard.writeText(allLines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border bg-background text-foreground font-mono text-[13px] overflow-hidden">
      {/* Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Build Pipeline Output</span>
          <span className="text-[11px] text-muted-foreground font-mono">
            commit {deployment.commitHash.substring(0, 7)}
          </span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <Radio className="size-2.5 animate-pulse" />
              Live SSE
            </span>
          )}
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
            onClick={toggleFollow}
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
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="divide-y divide-border/60 max-h-[560px] overflow-y-auto bg-background"
      >
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
