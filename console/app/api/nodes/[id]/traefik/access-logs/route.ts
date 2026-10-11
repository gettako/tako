import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const query = req.nextUrl.searchParams.toString();
    const endpoint = query
      ? `/api/v1/nodes/${id}/traefik/access-logs?${query}`
      : `/api/v1/nodes/${id}/traefik/access-logs`;
    const logs = await fetchServer(endpoint);
    return NextResponse.json(logs);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to fetch Traefik access logs' }, { status: 502 });
  }
}
