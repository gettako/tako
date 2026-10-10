import { NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET() {
  try {
    const snapshots = await fetchServer('/api/v1/backups/snapshots');
    return NextResponse.json(snapshots);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json([], { status: 200 });
  }
}
