import { NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function POST() {
  try {
    const data = await fetchServer<{ token: string }>('/api/v1/nodes/enroll-token', {
      method: 'POST',
    });
    return NextResponse.json(data);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to generate enroll token' }, { status: 502 });
  }
}
