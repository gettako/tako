'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Copy, Check, ArrowDown, Search, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LogLine {
  id?: string | number;
  timestamp?: string;
  level?: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface LogViewerProps {
  logs: (string | LogLine)[];
  maxHeight?: string | number;
  autoScroll?: boolean;
  isPaused?: boolean;
  onTogglePause?: () => void;
  showLineNumbers?: boolean;
  showTimestamps?: boolean;
  className?: string;
  title?: string;
}

export function LogViewer({
  logs = [],
  maxHeight = 480,
  autoScroll: initialAutoScroll = true,
  isPaused: externalPaused,
  onTogglePause,
  showLineNumbers = true,
  showTimestamps = true,
  className,
  title,
}: LogViewerProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(initialAutoScroll);
  const [internalPaused, setInternalPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isPaused = externalPaused !== undefined ? externalPaused : internalPaused;
  const togglePause = () => {
    if (onTogglePause) {
      onTogglePause();
    } else {
      setInternalPaused(!internalPaused);
    }
  };

  // Normalize logs to LogLine[]
  const parsedLogs: LogLine[] = logs.map((item, idx) => {
    if (typeof item === 'string') {
      const lower = item.toLowerCase();
      let level: LogLine['level'] = 'info';
      if (lower.includes('error') || lower.includes('fail') || lower.includes('fatal')) {
        level = 'error';
      } else if (lower.includes('warn')) {
        level = 'warn';
      } else if (lower.includes('debug')) {
        level = 'debug';
      }
      return { id: idx, message: item, level };
    }
    return { ...item, id: item.id ?? idx };
  });

  // Filter logs by search query
  const filteredLogs = searchQuery
    ? parsedLogs.filter((l) => l.message.toLowerCase().includes(searchQuery.toLowerCase()))
    : parsedLogs;

  const count = filteredLogs.length;

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22,
    overscan: 20,
  });

  // Auto-scroll when new logs arrive (only if not paused)
  useEffect(() => {
    if (autoScroll && !isPaused && parentRef.current && count > 0) {
      rowVirtualizer.scrollToIndex(count - 1, { align: 'end' });
    }
  }, [count, autoScroll, isPaused, rowVirtualizer]);

  // Handle manual scroll to disable auto-scroll if user scrolls up
  const handleScroll = () => {
    if (!parentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  };

  const copyToClipboard = async () => {
    const text = parsedLogs
      .map((l) => `${l.timestamp ? `[${l.timestamp}] ` : ''}${l.message}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn( 'relative flex flex-col rounded-lg border border-border bg-background text-foreground font-mono text-[13px] leading-relaxed overflow-hidden', className )}
    >
      {/* Log Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          {title ? (
            <span className="font-semibold text-foreground">{title}</span>
          ) : (
            <span className="text-muted-foreground">
              {filteredLogs.length} {filteredLogs.length === 1 ? 'line' : 'lines'}
            </span>
          )}
          {isPaused && (
            <span className="inline-flex items-center rounded-xs bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              Stream Paused
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search in logs */}
          <div className="relative flex items-center">
            <Search className="absolute left-2 size-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-32 sm:w-44 rounded border border-border bg-background pl-6 pr-2 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:border-primary"
            />
          </div>

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={togglePause}
            className={cn( 'inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] font-medium transition-colors', isPaused ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-border bg-background text-muted-foreground hover:text-foreground' )}
            title={isPaused ? 'Resume stream' : 'Pause stream'}
          >
            {isPaused ? <Play className="size-3 text-emerald-500" /> : <Pause className="size-3 text-amber-500" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Auto-scroll toggle */}
          <button
            type="button"
            onClick={() => {
              setAutoScroll(!autoScroll);
              if (!autoScroll && count > 0) {
                rowVirtualizer.scrollToIndex(count - 1, { align: 'end' });
              }
            }}
            className={cn( 'inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] font-medium transition-colors', autoScroll ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border bg-background text-muted-foreground hover:text-foreground' )}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            <ArrowDown className="size-3" />
            <span>Follow</span>
          </button>

          {/* Copy button */}
          <button
            type="button"
            onClick={copyToClipboard}
            className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="Copy logs to clipboard"
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Virtualized Log Container */}
      <div
        ref={parentRef}
        onScroll={handleScroll}
        style={{ height: maxHeight }}
        className="w-full overflow-auto p-4 select-text font-mono bg-background"
      >
        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground/70">No log entries found</div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const line = filteredLogs[virtualRow.index];
              if (!line) return null;

              // Line coloring
              let textColor = 'text-foreground/90';
              if (line.level === 'error') {
                textColor = 'text-destructive font-medium bg-destructive/10';
              } else if (line.level === 'warn') {
                textColor = 'text-amber-600 dark:text-amber-300 font-medium bg-amber-500/10';
              } else if (line.level === 'debug') {
                textColor = 'text-muted-foreground/70';
              }

              return (
                <div
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={cn( 'flex items-baseline gap-3 py-0.5 px-1 rounded-xs hover:bg-muted/40', textColor )}
                >
                  {showLineNumbers && (
                    <span className="w-8 shrink-0 select-none text-right font-mono text-[11px] text-muted-foreground/40">
                      {virtualRow.index + 1}
                    </span>
                  )}
                  {showTimestamps && line.timestamp && (
                    <span className="shrink-0 select-none text-[11px] text-muted-foreground/60">
                      {line.timestamp}
                    </span>
                  )}
                  <span className="break-all whitespace-pre-wrap">{line.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
