import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET() {
  try {
    const sessions = await fetchServer('/api/v1/auth/sessions');
    return NextResponse.json(sessions);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === 'revoke-others') {
      const res = await fetchServer('/api/v1/auth/sessions/revoke-others', {
        method: 'POST',
      });
      return NextResponse.json(res);
    }
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to revoke other sessions' }, { status: 500 });
  }
}
