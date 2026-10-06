'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Node } from '@/lib/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Copy,
  Check,
  Clock,
  HeartPulse,
  RotateCw,
  Terminal,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';

interface NodeSpecHeaderProps {
  node: Node;
  onRefresh?: () => void;
}

export function NodeSpecHeader({ node, onRefresh }: NodeSpecHeaderProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${field} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/nodes" className="text-sm">
              Nodes
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-semibold">{node.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Main Header Card (AC-4) */}
      <Card className="border-border/60 bg-card p-6">
        <CardContent className="px-0 py-0 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">
                  {node.name}
                </h1>
                  <StatusBadge status={node.status} />
                  <Badge
                    variant="outline"
                    className={`text-xs font-mono capitalize ${
                      node.role === 'leader'
                        ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                        : 'border-border/60 bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    {node.role}
                  </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                Node ID: {node.id}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  className="text-sm gap-1.5 h-9"
                >
                  <RotateCw className="size-3.5" />
                  Refresh
                </Button>
              )}
            </div>
          </div>

          {/* Hardware & OS Specifications Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4 border-t border-border/40 text-xs">
            {/* Private IP */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Private IP</span>
              <div className="flex items-center gap-1.5 font-mono text-foreground font-medium">
                <span>{node.ipAddress}</span>
                <button
                  type="button"
                  onClick={() => handleCopy('Private IP', node.ipAddress)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {copiedField === 'Private IP' ? (
                    <Check className="size-3 text-status-success" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Public IP */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Public IP</span>
              <div className="flex items-center gap-1.5 font-mono text-foreground font-medium">
                <span>{node.publicIp || 'None'}</span>
                {node.publicIp && (
                  <button
                    type="button"
                    onClick={() => handleCopy('Public IP', node.publicIp!)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedField === 'Public IP' ? (
                      <Check className="size-3 text-status-success" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* OS Distribution */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">OS Distribution</span>
              <div className="font-medium text-foreground truncate" title={node.os}>
                {node.os}
              </div>
            </div>

            {/* Kernel Release */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Kernel Release</span>
              <div className="font-mono text-foreground truncate" title={node.kernelVersion}>
                {node.kernelVersion || 'Linux 6.8.0-generic'}
              </div>
            </div>

            {/* Docker Daemon */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Docker Engine</span>
              <div className="font-mono text-foreground">
                v{node.dockerVersion}
              </div>
            </div>

            {/* System Uptime */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" />
                Uptime
              </span>
              <div className="font-medium text-foreground">
                {node.uptime}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
