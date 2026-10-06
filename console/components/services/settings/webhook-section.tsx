'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Service } from '@/lib/types';
import {
  getWebhookByService,
  getWebhookDeliveries,
  updateWebhookEvents,
  regenerateWebhookSecret,
  testWebhookDelivery,
} from '@/lib/api/webhooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from '@/components/ui/input-group';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { WebhookDeliveriesTable } from './webhook-deliveries-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Webhook as WebhookIcon,
  Copy,
  Check,
  RotateCw,
  Eye,
  EyeOff,
  Send,
  Loader2,
  AlertTriangle,
  History,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

interface WebhookSectionProps {
  service: Service;
}

export function WebhookSection({ service }: WebhookSectionProps) {
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const {
    data: webhook,
    isLoading: loadingWebhook,
  } = useQuery({
    queryKey: ['webhook', service.id],
    queryFn: () => getWebhookByService(service.id),
  });

  const {
    data: deliveries = [],
    isLoading: loadingDeliveries,
  } = useQuery({
    queryKey: ['webhook-deliveries', webhook?.id],
    queryFn: () => (webhook ? getWebhookDeliveries(webhook.id) : Promise.resolve([])),
    enabled: !!webhook,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['webhook', service.id] });
    if (webhook) {
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries', webhook.id] });
    }
  };

  const updateEventsMutation = useMutation({
    mutationFn: (newEvents: string[]) => {
      if (!webhook) throw new Error('No webhook');
      return updateWebhookEvents(webhook.id, newEvents);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Trigger events updated');
    },
    onError: () => toast.error('Failed to update trigger events'),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => {
      if (!webhook) throw new Error('No webhook');
      return regenerateWebhookSecret(webhook.id);
    },
    onSuccess: () => {
      invalidate();
      setRegenerateDialogOpen(false);
      toast.success('Webhook secret token regenerated');
    },
    onError: () => toast.error('Failed to regenerate secret'),
  });

  const handleCopyUrl = () => {
    if (!webhook) return;
    const fullUrl = `${webhook.url}?token=${webhook.secret}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(true);
    toast.success('Webhook deployment URL copied to clipboard');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleToggleEvent = (eventName: string) => {
    if (!webhook) return;
    const currentEvents = webhook.events || [];
    let updated: string[];
    if (currentEvents.includes(eventName)) {
      updated = currentEvents.filter((e) => e !== eventName);
    } else {
      updated = [...currentEvents, eventName];
    }
    updateEventsMutation.mutate(updated);
  };

  const handleTestPing = async () => {
    if (!webhook) return;
    try {
      setIsTesting(true);
      const delivery = await testWebhookDelivery(webhook.id, 'manual');
      invalidate();
      toast.success(`Test ping delivered successfully (${delivery.durationMs}ms, status 200)`);
    } catch {
      toast.error('Failed to dispatch test ping');
    } finally {
      setIsTesting(false);
    }
  };

  if (loadingWebhook) {
    return <LoadingSkeleton variant="cards" />;
  }

  const currentEvents = webhook?.events || [];
  const maskedSecret = webhook?.secret
    ? `${webhook.secret.slice(0, 8)}••••••••••••••••`
    : 'whsec_••••••••••••';

  return (
    <div className="space-y-6">
      {/* Webhook Configuration Card */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={WebhookIcon}
            title="Deployment Webhook Endpoint"
            description="Trigger automatic deployments by dispatching HTTP POST requests from GitHub, GitLab, or custom CI/CD pipelines."
          />
        </CardHeader>

        <CardContent className="px-0 space-y-5">
          {/* Webhook URL Input & Actions (AC-7) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Webhook URL</Label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <InputGroup className="font-mono text-sm bg-muted/30 flex-1">
                <InputGroupInput
                  readOnly
                  value={
                    webhook
                      ? `${webhook.url}?token=${showSecret ? webhook.secret : maskedSecret}`
                      : ''
                  }
                  className="font-mono text-sm"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => setShowSecret(!showSecret)}
                    title={showSecret ? 'Mask secret' : 'Reveal secret'}
                  >
                    {showSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="text-sm h-9 gap-1.5"
                >
                  {copiedUrl ? (
                    <Check className="size-3.5 text-status-success" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  Copy URL
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRegenerateDialogOpen(true)}
                  className="text-sm h-9 gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <RotateCw className="size-3.5" />
                  Regenerate
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Send a <code>POST</code> request with your bearer token or query parameter to initiate builds.
            </p>
          </div>

          {/* Trigger Event Toggles (AC-8) */}
          <div className="pt-3 border-t border-border space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Trigger Events
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Push to branch */}
              <div className="flex items-start justify-between p-3.5 rounded-lg border border-border bg-muted/20">
                <div className="space-y-0.5 pr-2">
                  <div className="text-sm font-medium text-foreground">Push to Branch</div>
                  <div className="text-sm text-muted-foreground">
                    Deploy when commits land on {service.branch || 'main'}.
                  </div>
                </div>
                <Switch
                  checked={currentEvents.includes('push')}
                  onCheckedChange={() => handleToggleEvent('push')}
                  aria-label="Toggle push event"
                />
              </div>

              {/* New tag */}
              <div className="flex items-start justify-between p-3.5 rounded-lg border border-border bg-muted/20">
                <div className="space-y-0.5 pr-2">
                  <div className="text-sm font-medium text-foreground">New Tag Created</div>
                  <div className="text-sm text-muted-foreground">
                    Deploy release versions (e.g. <code>v*</code>).
                  </div>
                </div>
                <Switch
                  checked={currentEvents.includes('tag')}
                  onCheckedChange={() => handleToggleEvent('tag')}
                  aria-label="Toggle tag event"
                />
              </div>

              {/* Manual curl trigger */}
              <div className="flex items-start justify-between p-3.5 rounded-lg border border-border bg-muted/20">
                <div className="space-y-0.5 pr-2">
                  <div className="text-sm font-medium text-foreground">Manual Trigger</div>
                  <div className="text-sm text-muted-foreground">
                    Allow direct API dispatches from scripts.
                  </div>
                </div>
                <Switch
                  checked={currentEvents.includes('manual')}
                  onCheckedChange={() => handleToggleEvent('manual')}
                  aria-label="Toggle manual event"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Deliveries Log Table Card (AC-8) */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={History}
            title="Recent Webhook Deliveries"
            description="History of incoming webhook dispatches, response status codes, and execution payloads."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestPing}
                disabled={isTesting}
                className="text-sm h-9 gap-1.5 shrink-0"
              >
                {isTesting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5 text-primary" />
                )}
                Send Test Ping
              </Button>
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2">
          {loadingDeliveries ? (
            <LoadingSkeleton variant="table" />
          ) : (
            <WebhookDeliveriesTable deliveries={deliveries} />
          )}
        </CardContent>
      </Card>

      {/* Regenerate Token Security Confirmation Popover/Dialog (AC-7) */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-status-warning">
              Regenerate Webhook Secret?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Regenerating this secret will immediately invalidate the existing webhook URL. Any GitHub or external CI/CD webhooks currently configured with the old token will fail until updated.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRegenerateDialogOpen(false)}
              className="text-sm"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              className="text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {regenerateMutation.isPending ? 'Regenerating...' : 'Confirm & Regenerate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
