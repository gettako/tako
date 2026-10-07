import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const nodeId = searchParams.get('nodeId') || searchParams.get('entityId') || '';
    const range = searchParams.get('range') || '1h';

    const metrics = await fetchServer(
      `/api/v1/metrics?nodeId=${encodeURIComponent(nodeId)}&range=${encodeURIComponent(range)}`
    );
    return NextResponse.json(metrics);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json([], { status: 200 });
  }
}
