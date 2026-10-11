import { NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET() {
  try {
    const data = await fetchServer('/api/v1/system/version');
    return NextResponse.json(data);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      {
        currentVersion: 'v1.0.0',
        latestVersion: 'v1.0.0',
        updateAvailable: false,
        releaseUrl: 'https://github.com/gettako/tako/releases',
        releaseNotes: 'Running the current release.',
        checkedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
