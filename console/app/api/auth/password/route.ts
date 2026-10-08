import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }

    try {
      const res = await fetchServer('/api/v1/auth/password', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return NextResponse.json(res);
    } catch (err: unknown) {
      if (err instanceof APIError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
