import { simulateDelay } from './delay';
import { mockWebhooks, mockWebhookDeliveries } from '@/lib/mock/data';
import { Webhook, WebhookDelivery } from '@/lib/types';

let webhooks = [...mockWebhooks];
let deliveries = [...mockWebhookDeliveries];

export async function getWebhookByService(serviceId: string): Promise<Webhook | null> {
  await simulateDelay();
  const wh = webhooks.find((w) => w.serviceId === serviceId);
  if (!wh) {
    // Generate a default webhook if none exists
    const defaultWh: Webhook = {
      id: `wh-${serviceId}`,
      serviceId,
      name: 'Git Deployment Trigger',
      url: `https://console.gettako.dev/api/webhooks/deploy/${serviceId}`,
      secret: `whsec_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      events: ['push', 'tag'],
      active: true,
      createdAt: new Date().toISOString(),
    };
    webhooks.push(defaultWh);
    return { ...defaultWh };
  }
  return { ...wh };
}

export async function getWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
  await simulateDelay();
  return deliveries
    .filter((d) => d.webhookId === webhookId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function updateWebhookEvents(webhookId: string, events: string[]): Promise<Webhook> {
  await simulateDelay();
  const index = webhooks.findIndex((w) => w.id === webhookId);
  if (index === -1) throw new Error(`Webhook ${webhookId} not found`);

  webhooks[index] = {
    ...webhooks[index],
    events,
  };
  return { ...webhooks[index] };
}

export async function regenerateWebhookSecret(webhookId: string): Promise<Webhook> {
  await simulateDelay();
  const index = webhooks.findIndex((w) => w.id === webhookId);
  if (index === -1) throw new Error(`Webhook ${webhookId} not found`);

  const newSecret = `whsec_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  webhooks[index] = {
    ...webhooks[index],
    secret: newSecret,
  };
  return { ...webhooks[index] };
}

export async function testWebhookDelivery(webhookId: string, event: string = 'manual'): Promise<WebhookDelivery> {
  await simulateDelay();
  const index = webhooks.findIndex((w) => w.id === webhookId);
  if (index === -1) throw new Error(`Webhook ${webhookId} not found`);

  const delivery: WebhookDelivery = {
    id: `whd-${Date.now()}`,
    webhookId,
    event,
    status: 'success',
    statusCode: 200,
    requestPayload: JSON.stringify(
      {
        event: 'ping_test',
        timestamp: new Date().toISOString(),
        sender: 'console-manual-test',
        headers: {
          'x-tako-delivery': `del-${Date.now()}`,
          'x-tako-event': event,
        },
      },
      null,
      2
    ),
    responseBody: JSON.stringify(
      {
        ok: true,
        message: 'Test ping acknowledged successfully',
        latencyMs: 32,
      },
      null,
      2
    ),
    durationMs: 32,
    timestamp: new Date().toISOString(),
  };

  deliveries.unshift(delivery);
  webhooks[index].lastTriggeredAt = delivery.timestamp;

  return { ...delivery };
}
