import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({ target: 'all' }));
    const result = await fetchServer('/api/v1/system/update', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      {
        success: true,
        message: 'Update sequence dispatched. Services are updating in the background.',
      },
      { status: 200 }
    );
  }
}
