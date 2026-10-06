export interface Webhook {
  id: string;
  serviceId: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  status: 'success' | 'failed';
  statusCode: number;
  requestPayload: string;
  responseBody: string;
  durationMs: number;
  timestamp: string;
}
