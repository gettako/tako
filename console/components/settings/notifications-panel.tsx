'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
} from '@/lib/api/settings';
import { NotificationSettings } from '@/lib/types';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Mail,
  MessageSquare,
  Send,
  Save,
  Loader2,
  BellRing,
  CheckCircle2,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

export function NotificationsPanel() {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  const { data: initialSettings } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: getNotificationSettings,
  });

  const [settings, setSettings] = useState<NotificationSettings>(
    initialSettings || {
      email: {
        enabled: true,
        smtpHost: 'smtp.mailgun.org',
        smtpPort: 587,
        fromEmail: 'alerts@gettako.dev',
      },
      slack: {
        enabled: true,
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/X00',
        channelName: '#infrastructure-alerts',
      },
      discord: {
        enabled: false,
        webhookUrl: '',
        channelName: '#tako-alerts',
      },
      telegram: {
        enabled: false,
        botToken: '',
        chatId: '',
      },
    }
  );

  React.useEffect(() => {
    if (initialSettings) {
      setSettings((prev) => ({
        ...prev,
        ...initialSettings,
        discord: initialSettings.discord || prev.discord || {
          enabled: false,
          webhookUrl: '',
          channelName: '#tako-alerts',
        },
      }));
    }
  }, [initialSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateNotificationSettings(settings);
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast.success('Notification channels updated');
    } catch {
      toast.error('Failed to save notification settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestChannel = async (channel: 'email' | 'slack' | 'discord' | 'telegram') => {
    try {
      setTestingChannel(channel);
      const res = await sendTestNotification(channel);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error('Test notification failed');
      }
    } catch {
      toast.error(`Failed to send test notification to ${channel}`);
    } finally {
      setTestingChannel(null);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* 1. Email (SMTP) Channel */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Mail}
            title="Email Alerts (SMTP)"
            description="Send critical alerts for node outages, failed deployments, and security incidents."
            action={
              <div className="flex items-center gap-2">
                {settings.email.enabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestChannel('email')}
                    disabled={testingChannel === 'email'}
                    className="h-8 text-xs gap-1.5"
                  >
                    {testingChannel === 'email' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <BellRing className="size-3.5" />
                    )}
                    Send Test
                  </Button>
                )}
                <Switch
                  checked={settings.email.enabled}
                  onCheckedChange={(val) =>
                    setSettings({
                      ...settings,
                      email: { ...settings.email, enabled: val },
                    })
                  }
                />
              </div>
            }
          />
        </CardHeader>

        {settings.email.enabled && (
          <CardContent className="px-0 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium text-foreground">SMTP Server Host</Label>
                <Input
                  value={settings.email.smtpHost}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      email: { ...settings.email, smtpHost: e.target.value },
                    })
                  }
                  placeholder="smtp.mailgun.org"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Port</Label>
                <Input
                  type="number"
                  value={settings.email.smtpPort}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      email: { ...settings.email, smtpPort: Number(e.target.value) },
                    })
                  }
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Sender From Email</Label>
              <Input
                value={settings.email.fromEmail}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    email: { ...settings.email, fromEmail: e.target.value },
                  })
                }
                placeholder="alerts@yourdomain.com"
                className="max-w-md font-mono text-sm"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* 2. Slack Webhook Channel */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={MessageSquare}
            title="Slack Webhook"
            description="Stream deployments and health status notifications into a Slack channel."
            action={
              <div className="flex items-center gap-2">
                {settings.slack.enabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestChannel('slack')}
                    disabled={testingChannel === 'slack'}
                    className="h-8 text-xs gap-1.5"
                  >
                    {testingChannel === 'slack' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <BellRing className="size-3.5" />
                    )}
                    Send Test
                  </Button>
                )}
                <Switch
                  checked={settings.slack.enabled}
                  onCheckedChange={(val) =>
                    setSettings({
                      ...settings,
                      slack: { ...settings.slack, enabled: val },
                    })
                  }
                />
              </div>
            }
          />
        </CardHeader>

        {settings.slack.enabled && (
          <CardContent className="px-0 pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Slack Incoming Webhook URL</Label>
              <Input
                value={settings.slack.webhookUrl}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    slack: { ...settings.slack, webhookUrl: e.target.value },
                  })
                }
                placeholder="https://hooks.slack.com/services/..."
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Channel Name</Label>
              <Input
                value={settings.slack.channelName}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    slack: { ...settings.slack, channelName: e.target.value },
                  })
                }
                placeholder="#infrastructure-alerts"
                className="max-w-xs font-mono text-sm"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* 3. Discord Webhook Channel */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={MessageSquare}
            title="Discord Webhook"
            description="Post cluster events, failed health checks, and build notifications to a Discord channel."
            action={
              <div className="flex items-center gap-2">
                {settings.discord?.enabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestChannel('discord')}
                    disabled={testingChannel === 'discord'}
                    className="h-8 text-xs gap-1.5"
                  >
                    {testingChannel === 'discord' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <BellRing className="size-3.5" />
                    )}
                    Send Test
                  </Button>
                )}
                <Switch
                  checked={settings.discord?.enabled ?? false}
                  onCheckedChange={(val) =>
                    setSettings({
                      ...settings,
                      discord: {
                        enabled: val,
                        webhookUrl: settings.discord?.webhookUrl || '',
                        channelName: settings.discord?.channelName || '#tako-alerts',
                      },
                    })
                  }
                />
              </div>
            }
          />
        </CardHeader>

        {settings.discord?.enabled && (
          <CardContent className="px-0 pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Discord Webhook URL</Label>
              <Input
                value={settings.discord?.webhookUrl || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    discord: {
                      enabled: true,
                      webhookUrl: e.target.value,
                      channelName: settings.discord?.channelName || '#tako-alerts',
                    },
                  })
                }
                placeholder="https://discord.com/api/webhooks/..."
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Channel / Identifier</Label>
              <Input
                value={settings.discord?.channelName || '#tako-alerts'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    discord: {
                      enabled: true,
                      webhookUrl: settings.discord?.webhookUrl || '',
                      channelName: e.target.value,
                    },
                  })
                }
                placeholder="#tako-alerts"
                className="max-w-xs font-mono text-sm"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* 4. Telegram Bot Channel */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Send}
            title="Telegram Bot"
            description="Receive instant cluster heartbeat alerts via Telegram bot messages."
            action={
              <div className="flex items-center gap-2">
                {settings.telegram.enabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestChannel('telegram')}
                    disabled={testingChannel === 'telegram'}
                    className="h-8 text-xs gap-1.5"
                  >
                    {testingChannel === 'telegram' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <BellRing className="size-3.5" />
                    )}
                    Send Test
                  </Button>
                )}
                <Switch
                  checked={settings.telegram.enabled}
                  onCheckedChange={(val) =>
                    setSettings({
                      ...settings,
                      telegram: { ...settings.telegram, enabled: val },
                    })
                  }
                />
              </div>
            }
          />
        </CardHeader>

        {settings.telegram.enabled && (
          <CardContent className="px-0 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Bot Token</Label>
                <Input
                  value={settings.telegram.botToken}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      telegram: { ...settings.telegram, botToken: e.target.value },
                    })
                  }
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Target Chat ID</Label>
                <Input
                  value={settings.telegram.chatId}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      telegram: { ...settings.telegram, chatId: e.target.value },
                    })
                  }
                  placeholder="-100123456789"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="default"
          disabled={isSaving}
          className="text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 active:not-aria-[haspopup]:translate-y-px"
        >
          {isSaving ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-3.5" />
              Save Notification Channels
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
