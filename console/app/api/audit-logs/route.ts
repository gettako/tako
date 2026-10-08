import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';
import { mockAuditLogs } from '@/lib/mock/data';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const logs = await fetchServer<Array<Record<string, unknown>>>(`/api/v1/audit-logs?limit=${limit}&offset=${offset}`);
    if (Array.isArray(logs)) {
      const sanitized = logs.map((l) => ({
        ...l,
        ipAddress: typeof l.ipAddress === 'string' && l.ipAddress.trim() !== '' ? l.ipAddress : clientIp,
      }));
      return NextResponse.json(sanitized);
    }
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
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const payload = {
      ...body,
      ipAddress: body.ipAddress || clientIp,
    };

    const log = await fetchServer('/api/v1/audit-logs', {
      method: 'POST',
      headers: {
        'X-Forwarded-For': clientIp,
        'X-Real-IP': clientIp,
      },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(log, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to record audit log' }, { status: 500 });
  }
}
