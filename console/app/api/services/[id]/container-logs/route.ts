import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const result = await fetchServer(`/api/v1/services/${id}/container-logs${queryString}`);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to fetch container logs' }, { status: 500 });
  }
}
