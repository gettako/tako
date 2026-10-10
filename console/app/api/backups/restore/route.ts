import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetchServer('/api/v1/backups/restore', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(res, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to restore backup snapshot' }, { status: 500 });
  }
}
