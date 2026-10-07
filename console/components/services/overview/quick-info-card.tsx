'use client';

import React from 'react';
import {
  Server,
  Network,
  ShieldCheck,
  GitBranch,
  Calendar,
  KeyRound,
  Box,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { Service } from '@/lib/types';

export interface QuickInfoCardProps {
  service: Service;
  onNavigateTab?: (tabId: string) => void;
}

export function QuickInfoCard({ service, onNavigateTab }: QuickInfoCardProps) {
  const buildSpec =
    service.dockerfile ||
    service.composeFile ||
    service.buildCommand ||
    (service.image ? `Image: ${service.image}` : 'Standard Dockerfile');

  return (
    <Card className="p-6 flex flex-col justify-between">
      <div>
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Server}
            title="Runtime & Configuration"
            description="Node placement, build specification, and runtime policies"
            action={
              onNavigateTab ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab('settings')}
                  className="h-7 text-xs gap-1 border-border hover:bg-muted text-foreground"
                >
                  <Settings className="size-3" />
                  <span>Settings</span>
                </Button>
              ) : undefined
            }
          />
        </CardHeader>

        <CardContent className="p-0">
          <dl className="divide-y divide-border/60 text-xs">
            {/* Assigned Node */}
            <div className="py-2.5 first:pt-0 flex items-center justify-between">
              <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Server className="size-3.5 text-muted-foreground" />
                Assigned Node
              </dt>
              <dd className="font-mono font-medium text-foreground flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                {service.nodeName}
              </dd>
            </div>

            {/* Build / Runtime Spec */}
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Box className="size-3.5 text-muted-foreground" />
                Build Target
              </dt>
              <dd className="font-mono text-foreground truncate max-w-[200px]" title={buildSpec}>
                {buildSpec}
              </dd>
            </div>

            {/* Repository & Branch */}
            {service.repository && (
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <GitBranch className="size-3.5 text-muted-foreground" />
                  Git Branch
                </dt>
                <dd
                  className="font-mono text-foreground truncate max-w-[200px]"
                  title={`${service.repository} (${service.branch || 'main'})`}
                >
                  {service.branch || 'main'}
                </dd>
              </div>
            )}

            {/* Environment Variables */}
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <KeyRound className="size-3.5 text-muted-foreground" />
                Environment
              </dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono text-foreground">
                  {service.envVars?.length || 0} variables
                </span>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('env')}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Edit
                  </button>
                )}
              </dd>
            </div>

            {/* Restart Policy */}
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <ShieldCheck className="size-3.5 text-muted-foreground" />
                Restart Policy
              </dt>
              <dd className="font-mono text-foreground">unless-stopped</dd>
            </div>

            {/* Created Timestamp */}
            <div className="py-2.5 last:pb-0 flex items-center justify-between">
              <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Calendar className="size-3.5 text-muted-foreground" />
                Created
              </dt>
              <dd className="font-mono text-muted-foreground">
                {new Date(service.createdAt).toLocaleDateString([], {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </div>

      {onNavigateTab && (
        <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span>Manage deployment hooks and build flags</span>
          <button
            type="button"
            onClick={() => onNavigateTab('settings')}
            className="text-foreground hover:underline font-medium inline-flex items-center gap-1 shrink-0 ml-2"
          >
            <span>Service Settings</span>
            <ArrowRight className="size-3" />
          </button>
        </div>
      )}
    </Card>
  );
}
