'use client';

import React from 'react';
import { Server, Network, ShieldCheck, GitBranch, Calendar } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Service } from '@/lib/types';

export interface QuickInfoCardProps {
  service: Service;
}

export function QuickInfoCard({ service }: QuickInfoCardProps) {
  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={Server}
          title="Service Metadata"
          description="Assigned host node, exposed network ports, and policy"
        />
      </CardHeader>

      <CardContent className="p-0">
        <dl className="divide-y divide-border/60 text-xs">
          <div className="py-2.5 first:pt-0 flex items-center justify-between">
            <dt className="text-muted-foreground flex items-center gap-1.5">
              <Server className="size-3.5" />
              Assigned Node
            </dt>
            <dd className="font-mono font-medium text-foreground">{service.nodeName}</dd>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <dt className="text-muted-foreground flex items-center gap-1.5">
              <Network className="size-3.5" />
              Exposed Ports
            </dt>
            <dd className="font-mono text-foreground">
              {service.ports.length > 0 ? service.ports.join(', ') : 'None'}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <dt className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              Restart Policy
            </dt>
            <dd className="font-mono text-foreground">unless-stopped</dd>
          </div>

          {service.repository && (
            <div className="py-2.5 flex items-center justify-between">
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <GitBranch className="size-3.5" />
                Source Branch
              </dt>
              <dd className="font-mono text-foreground truncate max-w-[180px]">
                {service.repository}:{service.branch}
              </dd>
            </div>
          )}

          <div className="py-2.5 last:pb-0 flex items-center justify-between">
            <dt className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5" />
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
    </Card>
  );
}
