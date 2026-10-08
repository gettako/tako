import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';
import { getSettingFallback, setSettingFallback } from '../store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  try {
    const setting = await fetchServer(`/api/v1/settings/${key}`);
    if (setting !== undefined && setting !== null) {
      setSettingFallback(key, setting);
      return NextResponse.json(setting);
    }
  } catch {
    // Backend unavailable or 404, fallback to local store
  }

  const fallback = getSettingFallback(key);
  if (fallback !== null) {
    return NextResponse.json(fallback);
  }

  return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  try {
    const body = await req.json();
    const val = body.value !== undefined ? body.value : body;

    // Persist in local store immediately
    setSettingFallback(key, val);

    // Try forwarding to Go backend orchestrator
    try {
      const result = await fetchServer(`/api/v1/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value: val }),
      });
      return NextResponse.json(result);
    } catch {
      // Backend unavailable; local persistence succeeded
      return NextResponse.json({
        key,
        value: val,
        status: 'saved_local',
      });
    }
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
