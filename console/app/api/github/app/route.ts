import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET() {
  try {
    const app = await fetchServer('/api/v1/github/app');
    return NextResponse.json(app);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  try {
    const result = await fetchServer('/api/v1/github/app', {
      method: 'DELETE',
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to disconnect GitHub App' }, { status: 500 });
  }
}
