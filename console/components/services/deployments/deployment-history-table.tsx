'use client';

import React, { useState, useMemo } from 'react';
import { GitCommit, GitBranch, RotateCcw, Clock, ChevronRight, Search, X, ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Deployment } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface DeploymentHistoryTableProps {
  deployments: Deployment[];
  selectedDeploymentId?: string;
  onSelectDeployment: (deployment: Deployment) => void;
  onRequestRollback: (deployment: Deployment) => void;
}

export function DeploymentHistoryTable({
  deployments,
  selectedDeploymentId,
  onSelectDeployment,
  onRequestRollback,
}: DeploymentHistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDeployments = useMemo(() => {
    if (!searchQuery.trim()) return deployments;
    const q = searchQuery.toLowerCase();
    return deployments.filter(
      (dep) =>
        dep.commitHash.toLowerCase().includes(q) ||
        dep.commitMessage.toLowerCase().includes(q) ||
        dep.branch.toLowerCase().includes(q) ||
        dep.author.toLowerCase().includes(q) ||
        dep.status.toLowerCase().includes(q)
    );
  }, [deployments, searchQuery]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Table Header Toolbar (Base Vega pattern) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2.5">
          <h4 className="text-sm font-semibold tracking-tight text-foreground">
            All Deployments
          </h4>
          <Badge
            variant="secondary"
            className="font-mono text-xs px-2 py-0.5 rounded-full font-medium"
          >
            {deployments.length}
          </Badge>
          {selectedDeploymentId && (
            <span className="hidden md:inline text-xs text-muted-foreground font-mono">
              • Select row to inspect pipeline
            </span>
          )}
        </div>

        {/* Quick Filter */}
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Filter commits, branch, author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full sm:w-64 pl-8 pr-7 text-xs font-mono bg-background"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table Data */}
      <Table>
        <TableHeader className="bg-muted/40 border-b border-border">
          <TableRow className="h-10 hover:bg-transparent">
            <TableHead className="w-[180px]">Commit</TableHead>
            <TableHead>Message & Branch</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="hidden sm:table-cell w-[150px]">Triggered</TableHead>
            <TableHead className="hidden md:table-cell w-[110px]">Duration</TableHead>
            <TableHead className="text-right w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border/40">
          {filteredDeployments.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="h-28 text-center text-xs text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-1.5 py-4">
                  <span>No deployments found matching &quot;{searchQuery}&quot;</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="text-xs h-7 text-primary hover:text-primary/90"
                  >
                    Clear search filter
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredDeployments.map((dep, index) => {
              const isSelected = selectedDeploymentId === dep.id;
              const isLatestActive = index === 0;
              const canRollback =
                !isLatestActive &&
                index < 5 &&
                dep.status !== 'running' &&
                dep.status !== 'queued';
              const durationSec = dep.durationMs
                ? Math.round(dep.durationMs / 1000)
                : null;

              return (
                <TableRow
                  key={dep.id}
                  onClick={() => onSelectDeployment(dep)}
                  className={cn( 'h-14 cursor-pointer transition-colors border-b border-border last:border-b-0', isSelected ? 'bg-primary/5 dark:bg-primary/10 font-medium' : 'hover:bg-muted/30' )}
                >
                  {/* Commit Hash & Author */}
                  <TableCell className="relative">
                    {isSelected && (
                      <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r bg-primary" />
                    )}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-1.5 py-0.5 rounded-md border border-border bg-muted/40 text-foreground">
                          <GitCommit className="size-3 text-muted-foreground" />
                          {dep.commitHash.substring(0, 7)}
                        </span>
                        {dep.isRollback && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-sans font-medium"
                          >
                            Rollback
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground pl-0.5">
                        by {dep.author}
                      </span>
                    </div>
                  </TableCell>

                    {/* Commit Message & Branch */}
                    <TableCell>
                      <div className="flex flex-col gap-1 max-w-xs md:max-w-sm lg:max-w-md">
                        <span className="text-xs text-foreground font-medium truncate">
                          {dep.commitMessage}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                          <GitBranch className="size-3 text-muted-foreground/70 shrink-0" />
                          <span className="truncate">{dep.branch}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <StatusBadge status={dep.status} size="sm" />
                    </TableCell>

                    {/* Trigger Timestamp */}
                    <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                      <div className="flex flex-col">
                        <span className="text-foreground/90 font-medium">
                          {new Date(dep.startedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                          {new Date(dep.startedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </TableCell>

                    {/* Duration */}
                    <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                      {durationSec !== null ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3 text-muted-foreground/70 shrink-0" />
                          <span>{durationSec}s</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>

                    {/* Rollback & Detail Actions */}
                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {dep.previewUrl && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs border-border hover:bg-muted text-foreground gap-1.5 active:not-aria-[haspopup]:translate-y-px"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(dep.previewUrl, '_blank', 'noopener,noreferrer');
                                  }}
                                />
                              }
                            >
                              <ExternalLink className="size-3 text-primary" />
                              <span className="hidden xl:inline">Preview</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Open deployment preview ({dep.previewUrl.replace(/^https?:\/\//, '')})
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Rollback & Detail Actions */}
                        {!isLatestActive && (
                          canRollback ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onRequestRollback(dep)}
                              className="h-7 px-2.5 text-xs border-border hover:bg-muted text-foreground gap-1.5 active:not-aria-[haspopup]:translate-y-px"
                            >
                              <RotateCcw className="size-3 text-muted-foreground" />
                              <span className="hidden lg:inline">Rollback</span>
                            </Button>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled
                                    className="h-7 px-2.5 text-xs opacity-40 cursor-not-allowed gap-1.5"
                                  />
                                }
                              >
                                <RotateCcw className="size-3" />
                                <span className="hidden lg:inline">Rollback</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {dep.status === 'running' || dep.status === 'queued'
                                  ? 'Deployment is in progress.'
                                  : 'Rollback is only available for the 5 most recent deployments.'}
                              </TooltipContent>
                            </Tooltip>
                          )
                        )}

                        <Button
                          variant={isSelected ? 'secondary' : 'ghost'}
                          size="icon"
                          onClick={() => onSelectDeployment(dep)}
                          className={cn( 'size-7 transition-colors active:not-aria-[haspopup]:translate-y-px', isSelected ? 'bg-primary/10 text-primary hover:bg-primary/15 font-semibold' : 'text-muted-foreground hover:text-foreground' )}
                          title={isSelected ? 'Currently inspecting' : 'Inspect deployment & logs'}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

      {/* Table Footer Summary (Base Vega pattern) */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/10 text-xs text-muted-foreground font-mono">
        <span>
          Showing {filteredDeployments.length} of {deployments.length} releases
        </span>
        {selectedDeploymentId && (
          <span className="text-[11px] text-primary">
            Inspecting release: {deployments.find((d) => d.id === selectedDeploymentId)?.commitHash.substring(0, 7) || selectedDeploymentId}
          </span>
        )}
      </div>
    </div>
  );
}
