import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const baseUrl = searchParams.get('baseUrl') || '';
    const appName = searchParams.get('appName') || 'Tako';
    const appSlug = searchParams.get('appSlug') || '';
    const query = new URLSearchParams();
    if (baseUrl) query.set('baseUrl', baseUrl);
    if (appName) query.set('appName', appName);
    if (appSlug) query.set('appSlug', appSlug);

    const manifest = await fetchServer(`/api/v1/github/manifest?${query.toString()}`);
    return NextResponse.json(manifest);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const origin = req.nextUrl.origin;
    const appName = req.nextUrl.searchParams.get('appName') || 'Tako';
    const appSlug = req.nextUrl.searchParams.get('appSlug') || `tako-${Math.floor(10000 + Math.random() * 90000)}`;
    const { buildGitHubAppManifest } = await import('@/lib/utils/github-manifest');
    return NextResponse.json(buildGitHubAppManifest({ name: appName, slug: appSlug, baseUrl: origin }));
  }
}
