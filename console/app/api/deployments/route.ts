import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get('serviceId');
    const path = serviceId ? `/api/v1/deployments?serviceId=${encodeURIComponent(serviceId)}` : '/api/v1/deployments';
    const deployments = await fetchServer(path);
    return NextResponse.json(deployments);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to fetch deployments' }, { status: 502 });
  }
}
