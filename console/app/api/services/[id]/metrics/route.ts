import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const range = searchParams.get('range') || '1h';

    // Try fetching from the backend Go API if running
    try {
      const data = await fetchServer(
        `/api/v1/services/${encodeURIComponent(id)}/metrics?range=${encodeURIComponent(range)}`
      );
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data);
      }
    } catch {
      // Backend may not have this specific service endpoint yet, fall back gracefully
    }

    return NextResponse.json([], { status: 200 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json([], { status: 200 });
  }
}
