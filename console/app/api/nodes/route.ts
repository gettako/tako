import { NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET() {
  try {
    const nodes = await fetchServer('/api/v1/nodes');
    return NextResponse.json(nodes);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to fetch nodes from master' }, { status: 502 });
  }
}
