import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await fetchServer(`/api/v1/deployments/${id}/rollback`, {
      method: 'POST',
    });
    return NextResponse.json(result, { status: 202 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to rollback deployment' }, { status: 500 });
  }
}
