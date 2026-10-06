'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Server, Boxes, Shield, Terminal, ArrowUpRight, Cpu, Sliders } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import Link from 'next/link';

export function OverviewPanel() {
  return (
    <div className="space-y-6">
      {/* Cluster Status Summary Card */}
      <Card className="border-border/60 bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Sliders}
            title="Tako Control Plane"
            description="Self-hosted container orchestration platform specifications."
            action={
              <Badge
                variant="outline"
                className="bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs gap-1"
              >
                <CheckCircle2 className="size-3" />
                Cluster Online
              </Badge>
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2 space-y-4 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg border border-border/60 bg-muted/20">
            <div>
              <span className="text-sm font-medium text-muted-foreground block mb-1">Tako Version</span>
              <span className="text-sm font-mono font-semibold text-foreground">v0.8.4-stable</span>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground block mb-1">Orchestrator Mode</span>
              <span className="text-sm font-medium text-foreground">Raft Multi-Node</span>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground block mb-1">API Architecture</span>
              <span className="text-sm font-mono text-foreground">REST + gRPC</span>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground block mb-1">Build Engine</span>
              <span className="text-sm font-mono text-foreground">BuildKit v0.15</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">
              You are running the latest production release of Tako.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="text-sm h-8 gap-1.5"
              render={<a href="https://github.com/gettako/tako/releases" target="_blank" rel="noreferrer" />}
            >
              <span>Release Notes</span>
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-border/60 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2.5 text-primary">
            <Server className="size-4" />
            <span className="font-semibold text-sm text-foreground">Nodes & Hardware</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Manage worker nodes, hardware quotas, and host kernel distributions.
          </p>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/nodes" />}
            className="w-full text-sm h-8 text-primary hover:text-primary justify-between"
          >
            <span>View 4 Nodes</span>
            <ArrowUpRight className="size-3.5" />
          </Button>
        </Card>

        <Card className="border-border/60 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2.5 text-status-success">
            <Boxes className="size-4" />
            <span className="font-semibold text-sm text-foreground">Projects & Services</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Review active deployment pipelines, databases, and Docker Compose stacks.
          </p>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/projects" />}
            className="w-full text-sm h-8 text-primary hover:text-primary justify-between"
          >
            <span>View Projects</span>
            <ArrowUpRight className="size-3.5" />
          </Button>
        </Card>

        <Card className="border-border/60 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2.5 text-status-warning">
            <Shield className="size-4" />
            <span className="font-semibold text-sm text-foreground">Security Audit Trail</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Inspect security events, environment variable updates, and administrative actions.
          </p>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/audit-logs" />}
            className="w-full text-sm h-8 text-primary hover:text-primary justify-between"
          >
            <span>View Audit Logs</span>
            <ArrowUpRight className="size-3.5" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
