import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await fetchServer(`/api/v1/projects/${id}`);
    return NextResponse.json(project);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 502 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const res = await fetchServer(`/api/v1/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return NextResponse.json(res);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      let message = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) message = parsed.error;
      } catch {
        // raw string
      }
      return NextResponse.json({ error: message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to update project' }, { status: 502 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cascade = req.nextUrl.searchParams.get('cascade');
    const endpoint = cascade === 'true'
      ? `/api/v1/projects/${id}?cascade=true`
      : `/api/v1/projects/${id}`;
    const res = await fetchServer(endpoint, { method: 'DELETE' });
    return NextResponse.json(res);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      let message = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) message = parsed.error;
      } catch {
        // raw string
      }
      return NextResponse.json({ error: message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 502 });
  }
}
