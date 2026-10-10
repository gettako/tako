'use client';

import React from 'react';
import {
  Server,
  ShieldCheck,
  GitBranch,
  Calendar,
  KeyRound,
  Box,
  Settings,
  ArrowRight,
  Database,
  HardDrive,
  Network,
  Copy,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { Service } from '@/lib/types';
import { toast } from 'sonner';

export interface QuickInfoCardProps {
  service: Service;
  onNavigateTab?: (tabId: string) => void;
}

export function QuickInfoCard({ service, onNavigateTab }: QuickInfoCardProps) {
  const isDatabase = service.type === 'database';
  const [copied, setCopied] = React.useState(false);

  const buildSpec =
    service.dockerfile ||
    service.composeFile ||
    service.buildCommand ||
    (service.image ? `Image: ${service.image}` : 'Standard Dockerfile');

  const dbPort = service.ports[0] || (service.databaseType === 'redis' ? 6379 : 5432);
  const dbName = service.name.replace(/-/g, '_');

  return (
    <Card className="p-6 flex flex-col justify-between">
      <div>
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={isDatabase ? Database : Server}
            title={isDatabase ? 'Database Instance Spec' : 'Runtime & Configuration'}
            description={
              isDatabase
                ? 'Engine specifications, storage mount, and cluster placement'
                : 'Node placement, build specification, and runtime policies'
            }
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

            {isDatabase ? (
              <>
                {/* Database Engine */}
                <div className="py-2.5 flex items-center justify-between">
                  <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Database className="size-3.5 text-muted-foreground" />
                    Engine
                  </dt>
                  <dd className="font-mono text-foreground capitalize">
                    {service.databaseType || 'postgresql'} {service.databaseVersion || '16'}
                  </dd>
                </div>

                {/* Default Database Name */}
                <div className="py-2.5 flex items-center justify-between">
                  <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Box className="size-3.5 text-muted-foreground" />
                    Default Database
                  </dt>
                  <dd className="font-mono text-foreground">{dbName}</dd>
                </div>

                {/* Internal Port */}
                <div className="py-2.5 flex items-center justify-between">
                  <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Network className="size-3.5 text-muted-foreground" />
                    Internal Port
                  </dt>
                  <dd className="font-mono text-foreground">{dbPort} / TCP</dd>
                </div>

                {/* Data Directory / Mount */}
                <div className="py-2.5 flex items-center justify-between">
                  <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <HardDrive className="size-3.5 text-muted-foreground" />
                    Volume Mount
                  </dt>
                  <dd className="font-mono text-muted-foreground text-[11px]">
                    tako-data-{service.slug || 'db'}
                  </dd>
                </div>

                {/* Connection URI */}
                {service.connectionString && (
                  <div className="py-2.5 flex items-center justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <KeyRound className="size-3.5 text-muted-foreground" />
                      Connection URI
                    </dt>
                    <dd className="flex items-center gap-2">
                      <code className="text-[11px] font-mono text-foreground bg-muted/50 px-1.5 py-0.5 rounded max-w-[200px] truncate" title={service.connectionString}>
                        {service.connectionString}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(service.connectionString || '');
                          setCopied(true);
                          toast.success('Connection string copied to clipboard');
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      >
                        {copied ? <Check className="size-3 text-status-success" /> : <Copy className="size-3" />}
                      </Button>
                    </dd>
                  </div>
                )}
              </>
            ) : (
              <>
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
              </>
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
          <span>{isDatabase ? 'Tune engine parameters & memory limits' : 'Manage deployment hooks and build flags'}</span>
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
