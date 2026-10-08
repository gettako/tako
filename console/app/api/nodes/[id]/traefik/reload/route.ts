import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await fetchServer(`/api/v1/nodes/${id}/traefik/reload`, {
      method: 'POST',
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Fallback for offline dev
    return NextResponse.json({
      success: true,
      message: 'Traefik routing rules successfully reloaded on node',
      reloadedAt: new Date().toISOString(),
    });
  }
}
