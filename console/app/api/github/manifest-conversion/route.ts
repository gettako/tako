import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await fetchServer('/api/v1/github/manifest/convert', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to convert manifest code' }, { status: 500 });
  }
}
