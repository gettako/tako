import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';
import { mockAuditLogs } from '@/lib/mock/data';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    const logs = await fetchServer(`/api/v1/audit-logs?limit=${limit}&offset=${offset}`);
    return NextResponse.json(logs);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Fallback to mock data if Go server is temporarily unreachable in local dev
    return NextResponse.json(mockAuditLogs);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const log = await fetchServer('/api/v1/audit-logs', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(log, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to record audit log' }, { status: 500 });
  }
}
