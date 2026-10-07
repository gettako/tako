import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const event = req.headers.get('x-github-event') || 'ping';
    const signature = req.headers.get('x-hub-signature-256') || '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-GitHub-Event': event,
    };
    if (signature) {
      headers['X-Hub-Signature-256'] = signature;
    }

    const result = await fetchServer('/api/v1/webhooks/github', {
      method: 'POST',
      headers,
      body: rawBody,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Return friendly webhook ack
    return NextResponse.json({ received: true, event: 'acknowledged' });
  }
}
