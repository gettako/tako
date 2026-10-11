import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  try {
    const { id, key } = await params;
    const res = await fetchServer(`/api/v1/projects/${id}/env/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    return NextResponse.json(res);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to delete project shared env var' }, { status: 502 });
  }
}
