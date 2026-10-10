'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhookKeys } from './keys';
import {
  getWebhookByService,
  getWebhookDeliveries,
  updateWebhookEvents,
  regenerateWebhookSecret,
  testWebhookDelivery,
} from '@/lib/api/webhooks';
import { Webhook, WebhookDelivery } from '@/lib/types';
import { toast } from 'sonner';

export function useWebhookByService(serviceId: string | undefined | null) {
  return useQuery<Webhook | null>({
    queryKey: serviceId ? webhookKeys.byService(serviceId) : ['webhooks', 'service', 'none'],
    queryFn: () => (serviceId ? getWebhookByService(serviceId) : Promise.resolve(null)),
    enabled: Boolean(serviceId),
  });
}

export function useWebhookDeliveries(webhookId: string | undefined | null) {
  return useQuery<WebhookDelivery[]>({
    queryKey: webhookId ? webhookKeys.deliveries(webhookId) : ['webhooks', 'deliveries', 'none'],
    queryFn: () => (webhookId ? getWebhookDeliveries(webhookId) : Promise.resolve([])),
    enabled: Boolean(webhookId),
  });
}

export function useUpdateWebhookEvents(serviceId: string, defaultWebhookId?: string) {
  const queryClient = useQueryClient();

  return useMutation<Webhook, Error, string[] | { webhookId: string; events: string[] }>({
    mutationFn: (variables) => {
      const webhookId = Array.isArray(variables) ? defaultWebhookId : variables.webhookId;
      const events = Array.isArray(variables) ? variables : variables.events;
      if (!webhookId) throw new Error('Webhook ID is required to update events');
      return updateWebhookEvents(webhookId, events);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.byService(serviceId) });
      toast.success('Trigger events updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update webhook events');
    },
  });
}

export function useRegenerateWebhookSecret(serviceId: string, defaultWebhookId?: string) {
  const queryClient = useQueryClient();

  return useMutation<Webhook, Error, string | void>({
    mutationFn: (overrideWebhookId) => {
      const webhookId = (typeof overrideWebhookId === 'string' ? overrideWebhookId : defaultWebhookId) || '';
      if (!webhookId) throw new Error('Webhook ID is required to regenerate secret');
      return regenerateWebhookSecret(webhookId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.byService(serviceId) });
      toast.success('Webhook signing secret regenerated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to regenerate webhook secret');
    },
  });
}

export function useTestWebhookDelivery(serviceId: string, defaultWebhookId?: string) {
  const queryClient = useQueryClient();

  return useMutation<WebhookDelivery, Error, string | { webhookId?: string; event?: string } | undefined>({
    mutationFn: (arg) => {
      const webhookId = (typeof arg === 'object' && arg?.webhookId ? arg.webhookId : defaultWebhookId) || '';
      const event = typeof arg === 'string' ? arg : (typeof arg === 'object' ? arg?.event : undefined);
      if (!webhookId) throw new Error('Webhook ID is required to test delivery');
      return testWebhookDelivery(webhookId, event);
    },
    onSuccess: (_, arg) => {
      const webhookId = (typeof arg === 'object' && arg?.webhookId ? arg.webhookId : defaultWebhookId) || '';
      if (webhookId) {
        queryClient.invalidateQueries({ queryKey: webhookKeys.deliveries(webhookId) });
      }
      queryClient.invalidateQueries({ queryKey: webhookKeys.byService(serviceId) });
      toast.success('Test payload delivered successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Test webhook delivery failed');
    },
  });
}
