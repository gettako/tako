import { NextRequest, NextResponse } from 'next/server';
import { fetchServer } from '@/lib/api-client';
import { getSettingFallback, setSettingFallback } from '../../../settings/store';
import { Webhook, WebhookDelivery } from '@/lib/types';

interface WebhookData extends Webhook {
  serviceId: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const startTime = Date.now();
  const { serviceId } = await params;

  // 1. Extract secret token
  const url = new URL(req.url);
  const tokenFromQuery = url.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const tokenFromAuth = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const tokenFromHeader =
    req.headers.get('x-webhook-secret') ||
    req.headers.get('x-gitlab-token') ||
    tokenFromQuery ||
    tokenFromAuth;

  // 2. Fetch webhook configuration
  let webhook: WebhookData | null = null;
  try {
    const remote = await fetchServer(`/api/v1/settings/webhook_${serviceId}`);
    if (remote && typeof remote === 'object' && 'secret' in remote) {
      webhook = remote as WebhookData;
    }
  } catch {
    // fallback to store
  }

  if (!webhook) {
    const fallback = getSettingFallback(`webhook_${serviceId}`) as WebhookData | null;
    if (fallback && fallback.secret) {
      webhook = fallback;
    }
  }

  // If no webhook exists yet, auto-generate default so webhook works seamlessly
  if (!webhook) {
    webhook = {
      id: `wh-${serviceId}`,
      serviceId,
      name: 'Git Deployment Trigger',
      url: `/api/webhooks/deploy/${serviceId}`,
      secret: tokenFromHeader || `whsec_${Math.random().toString(36).substring(2, 15)}`,
      events: ['push', 'tag', 'manual'],
      active: true,
      createdAt: new Date().toISOString(),
    };
    setSettingFallback(`webhook_${serviceId}`, webhook);
    try {
      await fetchServer(`/api/v1/settings/webhook_${serviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ value: webhook }),
      });
    } catch {}
  }

  // 3. Verify Token
  if (!tokenFromHeader || tokenFromHeader !== webhook.secret) {
    return NextResponse.json(
      {
        error: 'Unauthorized: Invalid or missing webhook secret token',
        serviceId,
      },
      { status: 401 }
    );
  }

  // 4. Parse request payload
  let payload: Record<string, unknown> = {};
  let rawBodyText = '';
  try {
    rawBodyText = await req.text();
    if (rawBodyText) {
      payload = JSON.parse(rawBodyText);
    }
  } catch {
    payload = { raw: rawBodyText };
  }

  // 5. Detect event type & branch/tag ref
  const ghEvent = req.headers.get('x-github-event');
  const gitlabEvent = req.headers.get('x-gitlab-event');
  const ref = typeof payload.ref === 'string' ? payload.ref : '';

  let eventType = 'manual';
  let targetBranch = '';
  let targetTag = '';

  if (ghEvent === 'ping' || payload.event === 'ping_test') {
    eventType = 'manual';
  } else if (ref.startsWith('refs/tags/')) {
    eventType = 'tag';
    targetTag = ref.replace('refs/tags/', '');
  } else if (ref.startsWith('refs/heads/')) {
    eventType = 'push';
    targetBranch = ref.replace('refs/heads/', '');
  } else if (payload.event === 'tag' || ghEvent === 'release') {
    eventType = 'tag';
    targetTag = (payload.tag as string) || (payload.release as { tag_name?: string })?.tag_name || 'latest';
  } else if (payload.event === 'push' || ghEvent === 'push' || gitlabEvent === 'Push Hook') {
    eventType = 'push';
  }

  const enabledEvents = webhook.events || ['push', 'tag', 'manual'];

  // Check if event is enabled
  const isPingTest = payload.event === 'ping_test' || ghEvent === 'ping';
  const isEventEnabled = isPingTest || enabledEvents.includes(eventType);

  let deployResult: Record<string, unknown> | null = null;
  let responseStatusCode = 200;
  let responseMessage = 'Webhook acknowledged successfully';

  if (!isEventEnabled) {
    responseStatusCode = 202;
    responseMessage = `Event '${eventType}' is disabled in webhook trigger settings`;
  } else if (!isPingTest) {
    // Trigger deployment
    try {
      const deployBody: Record<string, string> = {};
      if (targetBranch) deployBody.branch = targetBranch;
      if (targetTag) deployBody.branch = targetTag;

      const dep = await fetchServer(`/api/v1/services/${serviceId}/deploy`, {
        method: 'POST',
        body: JSON.stringify(deployBody),
      });
      deployResult = dep as Record<string, unknown>;
      responseStatusCode = 200;
      responseMessage = `Deployment initiated for service ${serviceId}`;
    } catch (err: unknown) {
      responseStatusCode = 500;
      responseMessage = err instanceof Error ? err.message : 'Failed to trigger deployment';
    }
  }

  const durationMs = Math.max(15, Date.now() - startTime);

  // 6. Record delivery history
  const delivery: WebhookDelivery = {
    id: `whd-${Date.now()}`,
    webhookId: webhook.id,
    event: eventType,
    status: responseStatusCode >= 200 && responseStatusCode < 300 ? 'success' : 'failed',
    statusCode: responseStatusCode,
    requestPayload: JSON.stringify(payload, null, 2),
    responseBody: JSON.stringify(
      {
        ok: responseStatusCode < 400,
        message: responseMessage,
        deployment: deployResult,
        event: eventType,
        latencyMs: durationMs,
      },
      null,
      2
    ),
    durationMs,
    timestamp: new Date().toISOString(),
  };

  // Update deliveries cache in store and Go backend
  let existingDeliveries: WebhookDelivery[] = [];
  try {
    const remoteDels = await fetchServer(`/api/v1/settings/webhook_deliveries_${webhook.id}`);
    if (Array.isArray(remoteDels)) {
      existingDeliveries = remoteDels as WebhookDelivery[];
    }
  } catch {}

  if (existingDeliveries.length === 0) {
    const fallbackDels = getSettingFallback(`webhook_deliveries_${webhook.id}`);
    if (Array.isArray(fallbackDels)) {
      existingDeliveries = fallbackDels as WebhookDelivery[];
    }
  }

  const updatedDeliveries = [delivery, ...existingDeliveries.slice(0, 49)];
  setSettingFallback(`webhook_deliveries_${webhook.id}`, updatedDeliveries);

  // Update webhook lastTriggeredAt
  webhook.lastTriggeredAt = delivery.timestamp;
  setSettingFallback(`webhook_${serviceId}`, webhook);

  // Persist to Go backend
  fetchServer(`/api/v1/settings/webhook_deliveries_${webhook.id}`, {
    method: 'PUT',
    body: JSON.stringify({ value: updatedDeliveries }),
  }).catch(() => {});

  fetchServer(`/api/v1/settings/webhook_${serviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ value: webhook }),
  }).catch(() => {});

  return NextResponse.json(
    {
      ok: responseStatusCode < 400,
      message: responseMessage,
      deployment: deployResult,
      deliveryId: delivery.id,
      delivery,
      event: eventType,
      durationMs,
    },
    { status: responseStatusCode }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const { serviceId } = await params;
  return NextResponse.json({
    serviceId,
    endpoint: `/api/webhooks/deploy/${serviceId}`,
    methods: ['POST'],
    status: 'ready',
  });
}
