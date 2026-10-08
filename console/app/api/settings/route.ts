import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';
import { getAllSettingsFallback, setSettingFallback } from './store';

export async function GET() {
  try {
    const settings = await fetchServer('/api/v1/settings');
    if (settings && typeof settings === 'object') {
      return NextResponse.json(settings);
    }
  } catch {
    // Fallback
  }
  return NextResponse.json(getAllSettingsFallback());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body && typeof body === 'object') {
      for (const [k, v] of Object.entries(body)) {
        setSettingFallback(k, v);
      }
    }
    try {
      const result = await fetchServer('/api/v1/settings', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return NextResponse.json(result);
    } catch {
      return NextResponse.json(body);
    }
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
