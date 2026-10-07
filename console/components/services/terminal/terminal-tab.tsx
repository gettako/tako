'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Terminal as TerminalIcon, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  ChevronUp, 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Service, Deployment } from '@/lib/types';
import { XtermTerminal, XtermTerminalRef } from './xterm-terminal';
import { SearchableSelect } from '@/components/ui/searchable-select';

export interface TerminalTabProps {
  service: Service;
  deployments?: Deployment[];
  isTabActive?: boolean;
  onNavigateToTerminalTab?: () => void;
}

function resolveActiveContainerName(service: Service, deployments?: Deployment[]): string {
  // 1. Check active deployment if present
  if (deployments && deployments.length > 0) {
    const dep = deployments[0];
    const rawCommit = dep.commitHash || service.commitHash || '';
    let commit8 = rawCommit.length > 8 ? rawCommit.slice(0, 8) : rawCommit;
    if (!commit8 || commit8 === 'main' || commit8 === 'master') {
      const cleanDep = dep.id.replace('dep-', '');
      commit8 = cleanDep.length >= 8 ? cleanDep.slice(0, 8) : '';
    }
    if (commit8) {
      return `tako-app-${service.slug}-${commit8}`;
    }
  }

  // 2. Check service commitHash synchronously available on initial render
  if (service.commitHash) {
    const rawCommit = service.commitHash;
    let commit8 = rawCommit.length > 8 ? rawCommit.slice(0, 8) : rawCommit;
    if (commit8 && commit8 !== 'main' && commit8 !== 'master') {
      return `tako-app-${service.slug}-${commit8}`;
    }
  }

  // 3. Fallback to base container name
  return `tako-app-${service.slug}`;
}

export function TerminalTab({ 
  service, 
  deployments,
  isTabActive = true,
  onNavigateToTerminalTab 
}: TerminalTabProps) {
  const containerOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    if (deployments && deployments.length > 0) {
      deployments.forEach((dep, idx) => {
        const rawCommit = dep.commitHash || service.commitHash || '';
        let commit8 = rawCommit.length > 8 ? rawCommit.slice(0, 8) : rawCommit;
        if (!commit8 || commit8 === 'main' || commit8 === 'master') {
          const cleanDep = dep.id.replace('dep-', '');
          commit8 = cleanDep.length >= 8 ? cleanDep.slice(0, 8) : '';
        }
        const name = commit8 ? `tako-app-${service.slug}-${commit8}` : `tako-app-${service.slug}`;
        if (!seen.has(name)) {
          seen.add(name);
          opts.push({
            value: name,
            label: idx === 0 ? `${name} (Active)` : `${name} (rev: ${commit8})`,
          });
        }
      });
    } else if (service.commitHash) {
      const rawCommit = service.commitHash;
      const commit8 = rawCommit.length > 8 ? rawCommit.slice(0, 8) : rawCommit;
      const name = `tako-app-${service.slug}-${commit8}`;
      seen.add(name);
      opts.push({
        value: name,
        label: `${name} (Active)`,
      });
    }

    const baseName = `tako-app-${service.slug}`;
    if (!seen.has(baseName)) {
      opts.push({
        value: baseName,
        label: `${baseName} (Auto-resolve)`,
      });
    }

    if (service.replicas > 1) {
      opts.push({
        value: `tako-app-${service.slug}-2`,
        label: `tako-app-${service.slug}-2`,
      });
    }

    return opts;
  }, [deployments, service.commitHash, service.slug, service.replicas]);

  // Synchronous resolution prevents jumping from tako-app-<slug> to tako-app-<slug>-<commit>
  const [selectedContainer, setSelectedContainer] = useState(() =>
    resolveActiveContainerName(service, deployments)
  );
  const isUserSelectedRef = useRef(false);

  // Sync when deployments first arrive only if user hasn't explicitly chosen a container
  useEffect(() => {
    if (isUserSelectedRef.current) return;
    const resolved = resolveActiveContainerName(service, deployments);
    if (resolved && resolved !== selectedContainer) {
      setSelectedContainer(resolved);
    }
  }, [deployments, service, selectedContainer]);

  const handleSelectContainer = useCallback((val: string) => {
    isUserSelectedRef.current = true;
    setSelectedContainer(val);
  }, []);

  const [viewMode, setViewMode] = useState<'inline' | 'fullscreen' | 'minimized'>('inline');
  const termRef = useRef<XtermTerminalRef>(null);

  // Auto-fit whenever viewMode changes or tab becomes active
  useEffect(() => {
    const timer = setTimeout(() => {
      termRef.current?.fit();
    }, 60);
    return () => clearTimeout(timer);
  }, [viewMode, isTabActive]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewMode === 'fullscreen') {
        setViewMode('inline');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  const handleClear = () => {
    termRef.current?.clear();
  };

  const handleRestore = () => {
    setViewMode('inline');
    onNavigateToTerminalTab?.();
    setTimeout(() => {
      termRef.current?.fit();
      termRef.current?.focus();
    }, 60);
  };

  const handleFullscreen = () => {
    setViewMode('fullscreen');
    setTimeout(() => {
      termRef.current?.fit();
      termRef.current?.focus();
    }, 60);
  };

  const handleMinimize = () => {
    setViewMode('minimized');
  };

  return (
    <>
      {/* 1. Minimized Floating Dock */}
      {viewMode === 'minimized' && (
        <div className="fixed bottom-5 right-6 z-50 flex items-center gap-3 rounded-xl border border-border bg-background/95 px-4 py-2.5 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <TerminalIcon className="size-3.5 text-primary" />
              <span>{selectedContainer}</span>
            </div>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">(Session Active)</span>
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestore}
              className="size-7 p-0 text-foreground hover:bg-muted"
              title="Restore to inline view"
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFullscreen}
              className="size-7 p-0 text-foreground hover:bg-muted"
              title="Expand to Fullscreen"
            >
              <Maximize2 className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="size-7 p-0 text-muted-foreground hover:text-foreground"
              title="Clear terminal buffer"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* 2. Main Terminal Container (Unified single instance to preserve terminal buffer across modes) */}
      <div className={viewMode === 'fullscreen' ? 'fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-xl p-4 sm:p-6 animate-in fade-in duration-150' : viewMode === 'minimized' || !isTabActive ? 'hidden' : 'space-y-4'}>
        {/* Fullscreen Header */}
        {viewMode === 'fullscreen' ? (
          <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/40">
                <TerminalIcon className="size-4.5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-foreground">Interactive Container Shell</h3>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Connected</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: <span className="font-mono text-foreground">{selectedContainer}</span> • Press ESC to exit full screen
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground hidden sm:inline">Target:</span>
                <SearchableSelect
                  value={selectedContainer}
                  onValueChange={handleSelectContainer}
                  options={containerOptions}
                  size="sm"
                  className="h-8 font-mono text-xs w-52 bg-background"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="size-8 p-0 border-border bg-background"
                title="Clear screen"
              >
                <Trash2 className="size-3.5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('inline')}
                className="size-8 p-0 border-border bg-background"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          /* Inline Header */
          <SectionHeader
            icon={TerminalIcon}
            title="Interactive Shell"
            description="Execute diagnostic commands directly inside the container"
            action={
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground hidden sm:inline">Target:</span>
                  <SearchableSelect
                    value={selectedContainer}
                    onValueChange={handleSelectContainer}
                    options={containerOptions}
                    size="sm"
                    className="h-8 font-mono text-xs w-52 bg-card"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="size-8 p-0"
                  title="Clear screen"
                >
                  <Trash2 className="size-3.5" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFullscreen}
                  className="size-8 p-0"
                  title="Full screen"
                >
                  <Maximize2 className="size-3.5" />
                </Button>
              </div>
            }
          />
        )}

        {/* Single Terminal Canvas */}
        <div className={viewMode === 'fullscreen' ? 'flex-1 w-full min-h-0 rounded-lg border border-border bg-background overflow-hidden' : 'rounded-lg border border-border bg-background p-1 min-h-[440px] h-[520px] overflow-hidden'}>
          <XtermTerminal
            ref={termRef}
            service={service}
            containerName={selectedContainer}
            className="h-full"
          />
        </div>
      </div>
    </>
  );
}
