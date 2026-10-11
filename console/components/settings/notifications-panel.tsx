'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Mail,
  MessageSquare,
  Send,
  Webhook,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { SettingsSectionHeader } from '@/components/settings/settings-section-header';
import Link from 'next/link';

export function NotificationsPanel() {
  const plannedChannels = [
    {
      icon: Mail,
      name: 'Email Alerts (SMTP)',
      description:
        'Deliver critical failure alerts, automated rollback notices, and node outage reports via your custom SMTP server.',
      status: 'Planned',
    },
    {
      icon: MessageSquare,
      name: 'Discord Webhooks',
      description:
        'Post rich deployment status cards, container health warnings, and commit logs directly into your Discord channels.',
      status: 'Planned',
    },
    {
      icon: MessageSquare,
      name: 'Slack Webhooks',
      description:
        'Stream real-time deployment status, error traces, and team notifications into designated Slack channels.',
      status: 'Planned',
    },
    {
      icon: Send,
      name: 'Telegram Bot',
      description:
        'Receive instant mobile push notifications and emergency node alerts directly through a configured Telegram bot.',
      status: 'Planned',
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SettingsSectionHeader
            icon={Bell}
            title="Notification Channels & Alerts"
            description="Configure automated alerting for deployment events, node failures, and security incidents."
            action={
              <Badge variant="outline" className="gap-1.5 text-xs text-muted-foreground font-normal border-border">
                <Clock className="size-3 text-muted-foreground" />
                Coming Soon
              </Badge>
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2 space-y-6">
          {/* Informational Hero Banner */}
          <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-primary/70 animate-pulse" />
              <h4 className="text-sm font-semibold text-foreground">
                Outbound Alert Adapters in Active Development
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              Tako currently tracks all cluster events and deployment statuses in the local{' '}
              <Link href="/audit-logs" className="text-primary hover:underline font-medium">
                Audit Logs
              </Link>{' '}
              and live telemetry streams. Outbound delivery to external notification channels (SMTP, Slack, Discord, Telegram) is planned in our development roadmap.
            </p>
          </div>

          {/* Planned Channels Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plannedChannels.map((channel) => {
              const Icon = channel.icon;
              return (
                <div
                  key={channel.name}
                  className="flex flex-col justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/10 transition-colors space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-4" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{channel.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-mono font-normal">
                        {channel.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {channel.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Roadmap Reference Footer */}
          <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border">
            <span>Want to track upcoming notification adapters?</span>
            <a
              href="https://docs.gettako.dev/roadmap"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
            >
              <span>View Tako Roadmap</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
