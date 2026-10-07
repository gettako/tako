import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; domainId: string }> }
) {
  try {
    const { id, domainId } = await params;
    const result = await fetchServer(`/api/v1/services/${id}/domains/${domainId}`, {
      method: 'DELETE',
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to delete domain' }, { status: 500 });
  }
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; domainId: string }> }
) {
  try {
    const { id, domainId } = await params;
    const result = await fetchServer(`/api/v1/services/${id}/domains/${domainId}/primary`, {
      method: 'PATCH',
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to update primary domain' }, { status: 500 });
  }
}
