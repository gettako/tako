import { NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function POST() {
  try {
    const res = await fetchServer('/api/v1/backups/snapshot', {
      method: 'POST',
    });
    return NextResponse.json(res, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to create backup snapshot' }, { status: 500 });
  }
}
