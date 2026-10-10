'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  ArrowLeft,
  Terminal,
  Copy,
  Check,
  RotateCcw,
  Server,
  Layers,
  ScrollText,
  CornerDownRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { openCommandPalette } from '@/hooks/use-command-palette';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DiagnosticStep {
  id: string;
  timestamp: string;
  message: string;
  status: 'ok' | 'warn' | 'fail' | 'info';
  duration?: string;
}

const INITIAL_STEPS: DiagnosticStep[] = [
  {
    id: '1',
    timestamp: '00:00.012',
    message: 'CONNECT gateway -> Traefik v3.1 reverse proxy (mTLS 1.3)',
    status: 'ok',
    duration: '1.2ms',
  },
  {
    id: '2',
    timestamp: '00:00.038',
    message: 'ROUTER_LOOKUP -> Ingress rules for host & route prefix',
    status: 'warn',
    duration: '0 matches',
  },
  {
    id: '3',
    timestamp: '00:00.065',
    message: 'AGENT_PROBE -> Querying active nodes (srv-node-1, srv-node-2)',
    status: 'ok',
    duration: 'all healthy',
  },
  {
    id: '4',
    timestamp: '00:00.092',
    message: 'CONTAINER_SCAN -> Matching deployment spec in registry',
    status: 'fail',
    duration: 'not found',
  },
  {
    id: '5',
    timestamp: '00:00.118',
    message: 'RESULT -> HTTP 404 (ERR_ROUTE_NOT_REGISTERED_IN_CLUSTER)',
    status: 'info',
  },
];

export default function NotFound() {
  const pathname = usePathname() || '/unknown-route';
  const router = useRouter();
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [isRunningTrace, setIsRunningTrace] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_STEPS.length);

  // Format requested route safely
  const displayPath = pathname.length > 50 ? `${pathname.slice(0, 47)}...` : pathname;

  const handleCopyPath = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedPath(true);
      toast.success('Route URL copied to clipboard');
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const handleCopyReport = () => {
    const report = {
      error: '404_ROUTE_NOT_FOUND',
      path: pathname,
      ingress: 'Traefik v3.1',
      clusterStatus: 'online',
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopiedReport(true);
    toast.success('Diagnostic report copied to clipboard');
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleRunTrace = () => {
    if (isRunningTrace) return;
    setIsRunningTrace(true);
    setVisibleCount(0);

    INITIAL_STEPS.forEach((step, idx) => {
      setTimeout(() => {
        setVisibleCount(idx + 1);
        if (idx === INITIAL_STEPS.length - 1) {
          setIsRunningTrace(false);
          toast.info('Traceroute completed: 0 endpoints matched');
        }
      }, (idx + 1) * 180);
    });
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col min-h-screen w-screen bg-background overflow-y-auto select-none">
      {/* Floating Theme Toggle (No Header bar) */}
      <div className="absolute top-4 right-4 z-40 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      {/* Main 404 Content Area (Centered) */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 w-full max-w-4xl mx-auto my-auto animate-fade-in py-10 sm:py-14">
        {/* Visual Centerpiece: Deep-Sea Radar + Takō Mascot */}
        <div className="relative mb-5 flex size-48 sm:size-56 items-center justify-center">
          {/* Radar Concentric Rings */}
          <svg
            className="absolute inset-0 size-full pointer-events-none opacity-60 dark:opacity-40"
            viewBox="0 0 240 240"
          >
            {/* Outer circle */}
            <circle
              cx="120"
              cy="120"
              r="110"
              fill="none"
              className="stroke-border"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {/* Middle circle */}
            <circle
              cx="120"
              cy="120"
              r="80"
              fill="none"
              className="stroke-border"
              strokeWidth="1"
            />
            {/* Inner circle */}
            <circle
              cx="120"
              cy="120"
              r="50"
              fill="none"
              className="stroke-primary/30 dark:stroke-primary/40"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            {/* Crosshairs */}
            <line
              x1="120"
              y1="10"
              x2="120"
              y2="230"
              className="stroke-border"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <line
              x1="10"
              y1="120"
              x2="230"
              y2="120"
              className="stroke-border"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            {/* Center target indicator */}
            <circle cx="120" cy="120" r="3" className="fill-primary" />
          </svg>

          {/* Pulse Sweep Animation Ring */}
          <div className="absolute inset-4 rounded-full border border-primary/20 dark:border-primary/30 animate-ping opacity-25 pointer-events-none" />

          {/* Floating Takō Mascot */}
          <div className="relative z-10 flex size-28 sm:size-32 items-center justify-center transition-transform hover:scale-105 duration-300">
            <Image
              src="/images/tako.png"
              alt="Takō Mascot"
              width={128}
              height={128}
              className="size-24 sm:size-28 object-contain drop-shadow-none"
              priority
            />
          </div>

          {/* Floating Telemetry Coordinates */}
          <div className="absolute top-1 right-0 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-mono text-muted-foreground backdrop-blur-sm">
            DEPTH: -404m
          </div>
          <div className="absolute bottom-1 left-0 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-mono text-muted-foreground backdrop-blur-sm">
            INGRESS: 0_RULES
          </div>
        </div>

        {/* Main Error Copy & Target Path */}
        <div className="text-center space-y-2.5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-mono text-muted-foreground">
            <span className="size-2 rounded-full bg-status-danger animate-pulse" />
            <span>STATUS 404 // ROUTE_NOT_REGISTERED</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-sans">
            Signal Lost in Cluster Depth
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Takō scanned all ingress routers and worker nodes, but no active container
            or endpoint matches this route.
          </p>

          {/* Requested Path Chip */}
          <div className="pt-1.5 flex items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-mono text-foreground">
              <CornerDownRight className="size-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground">GET</span>
              <span className="text-primary font-semibold truncate max-w-xs sm:max-w-md">
                {displayPath}
              </span>
              <button
                onClick={handleCopyPath}
                className="ml-1 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
                title="Copy path"
                aria-label="Copy path"
              >
                {copiedPath ? (
                  <Check className="size-3.5 text-status-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons in Body */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <Button
            render={<Link href="/" />}
            size="default"
            className="h-9 px-4 gap-2 font-medium"
          >
            <LayoutDashboard className="size-4" />
            <span>Return to Dashboard</span>
          </Button>

          <Button
            variant="outline"
            size="default"
            onClick={openCommandPalette}
            className="h-9 px-4 gap-2"
          >
            <Search className="size-4" />
            <span>Quick Search</span>
            <kbd className="ml-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="default"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.push('/');
              }
            }}
            className="h-9 px-3 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span>Go Back</span>
          </Button>
        </div>

        {/* Sleek Terminal Box with Compact Header */}
        <div className="mt-8 w-full">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Compact Terminal Header: Snug height and padding */}
            <div className="flex h-8.5 items-center justify-between border-b border-border bg-muted/25 px-3">
              <div className="flex items-center gap-2">
                {/* Mac style terminal dots */}
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#FF5F56]" />
                  <span className="size-2 rounded-full bg-[#FFBD2E]" />
                  <span className="size-2 rounded-full bg-[#27C93F]" />
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <Terminal className="size-3 text-primary" />
                  <span className="truncate max-w-[200px] sm:max-w-md">
                    tako traceroute --target {displayPath}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleRunTrace}
                  disabled={isRunningTrace}
                  className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw
                    className={cn('size-3', isRunningTrace && 'animate-spin text-primary')}
                  />
                  <span>{isRunningTrace ? 'Tracing...' : 'Re-run Trace'}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleCopyReport}
                  className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                >
                  {copiedReport ? (
                    <Check className="size-3 text-status-success" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>Copy Diagnostics</span>
                </Button>
              </div>
            </div>

            {/* Terminal Body with fixed height: strictly zero layout shifts */}
            <div className="p-3 font-mono text-xs space-y-1 bg-muted/10 dark:bg-[#07080E]/70 min-h-[142px]">
              {INITIAL_STEPS.map((step, idx) => {
                const isVisible = idx < visibleCount;
                const statusColor =
                  step.status === 'ok'
                    ? 'text-status-success'
                    : step.status === 'warn'
                    ? 'text-status-warning'
                    : step.status === 'fail'
                    ? 'text-status-danger'
                    : 'text-primary';

                const statusBadge =
                  step.status === 'ok'
                    ? '[OK]'
                    : step.status === 'warn'
                    ? '[UNMATCHED]'
                    : step.status === 'fail'
                    ? '[NOT_FOUND]'
                    : '[ERR_404]';

                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-0.5 border-b border-border/40 last:border-0 transition-opacity duration-150',
                      isVisible ? 'opacity-100' : 'invisible'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/60 select-none">
                        [{step.timestamp}]
                      </span>
                      <span className="text-foreground">{step.message}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 sm:pl-4">
                      {step.duration && (
                        <span className="text-muted-foreground text-[11px]">
                          {step.duration}
                        </span>
                      )}
                      <span className={cn('font-semibold text-[11px]', statusColor)}>
                        {statusBadge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Helpful Quick Navigation Links */}
        <div className="mt-7 w-full">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">
              Cluster Alternative Routes
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              3 operational paths
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/services"
              className="group flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md border border-border bg-muted/30 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Layers className="size-4" />
                  </div>
                  <span className="font-medium text-sm text-foreground">Services</span>
                </div>
                <ArrowLeft className="size-3.5 rotate-180 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Inspect active containers, deployment health, and mapped domains.
              </p>
            </Link>

            <Link
              href="/nodes"
              className="group flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md border border-border bg-muted/30 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Server className="size-4" />
                  </div>
                  <span className="font-medium text-sm text-foreground">Nodes</span>
                </div>
                <ArrowLeft className="size-3.5 rotate-180 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Monitor server node health, Traefik proxy config, CPU and RAM usage.
              </p>
            </Link>

            <Link
              href="/audit-logs"
              className="group flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md border border-border bg-muted/30 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <ScrollText className="size-4" />
                  </div>
                  <span className="font-medium text-sm text-foreground">Audit Logs</span>
                </div>
                <ArrowLeft className="size-3.5 rotate-180 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Review cluster events and deployment history to verify deleted resources.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
