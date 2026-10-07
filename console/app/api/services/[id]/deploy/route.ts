import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await fetchServer(`/api/v1/services/${id}/deploy`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(result, { status: 202 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to trigger deployment' }, { status: 500 });
  }
}
