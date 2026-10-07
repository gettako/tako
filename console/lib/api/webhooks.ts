import { simulateDelay } from './delay';
import { mockWebhooks, mockWebhookDeliveries } from '@/lib/mock/data';
import { Webhook, WebhookDelivery } from '@/lib/types';

let webhooks = [...mockWebhooks];
let deliveries = [...mockWebhookDeliveries];

async function fetchFromBFF<T>(key: string, fallback: T): Promise<T> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/settings/${key}`);
      if (res.ok) {
        const data = await res.json();
        if (data !== undefined && data !== null) {
          return data as T;
        }
      }
    } catch {
      // fallback
    }
  }
  return fallback;
}

async function saveToBFF<T>(key: string, value: T): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
    } catch {
      // fallback
    }
  }
}

export async function getWebhookByService(serviceId: string): Promise<Webhook | null> {
  const remote = await fetchFromBFF<Webhook | null>(`webhook_${serviceId}`, null);
  if (remote) {
    const idx = webhooks.findIndex((w) => w.id === remote.id);
    if (idx !== -1) webhooks[idx] = remote;
    else webhooks.push(remote);
    return remote;
  }

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
    await saveToBFF(`webhook_${serviceId}`, defaultWh);
    return { ...defaultWh };
  }
  return { ...wh };
}

export async function getWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
  const remote = await fetchFromBFF<WebhookDelivery[] | null>(`webhook_deliveries_${webhookId}`, null);
  if (remote && Array.isArray(remote)) {
    deliveries = [
      ...deliveries.filter((d) => d.webhookId !== webhookId),
      ...remote,
    ];
    return remote.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

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
  const updated = { ...webhooks[index] };
  await saveToBFF(`webhook_${updated.serviceId}`, updated);
  return updated;
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
  const updated = { ...webhooks[index] };
  await saveToBFF(`webhook_${updated.serviceId}`, updated);
  return updated;
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
  const updatedWh = { ...webhooks[index] };

  await saveToBFF(`webhook_${updatedWh.serviceId}`, updatedWh);
  const currentDeliveries = deliveries.filter((d) => d.webhookId === webhookId);
  await saveToBFF(`webhook_deliveries_${webhookId}`, currentDeliveries);

  return { ...delivery };
}
