import { NextRequest, NextResponse } from 'next/server';
import { getServerBaseURL } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const upstreamUrl = `${getServerBaseURL()}/api/v1/deployments/${id}/logs`;
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: 'text/event-stream',
      },
      cache: 'no-store',
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'Failed to connect to log stream' },
        { status: upstream.status || 502 }
      );
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upstream SSE error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
