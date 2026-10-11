import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cronId: string }> }
) {
  try {
    const { id, cronId } = await params;
    const res = await fetch(
      `${API_BASE_URL}/api/v1/services/${encodeURIComponent(id)}/crons/${encodeURIComponent(cronId)}/runs`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error || `Upstream error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
