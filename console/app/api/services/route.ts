import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET() {
  try {
    const services = await fetchServer('/api/v1/services');
    return NextResponse.json(services);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const service = await fetchServer('/api/v1/services', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(service, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}
