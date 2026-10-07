import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const baseUrl = searchParams.get('baseUrl') || '';
    const appName = searchParams.get('appName') || '';
    const query = new URLSearchParams();
    if (baseUrl) query.set('baseUrl', baseUrl);
    if (appName) query.set('appName', appName);

    const manifest = await fetchServer(`/api/v1/github/manifest?${query.toString()}`);
    return NextResponse.json(manifest);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const origin = req.nextUrl.origin;
    return NextResponse.json({
      name: 'Takō Cloud',
      url: origin,
      hook_attributes: {
        url: `${origin}/api/webhooks/github`,
        active: true,
      },
      redirect_url: `${origin}/settings?tab=git&setup=github`,
      callback_urls: [`${origin}/api/auth/callback/github`],
      public: false,
      default_permissions: {
        contents: 'read',
        metadata: 'read',
        pull_requests: 'read',
        statuses: 'write',
        deployments: 'write',
      },
      default_events: [
        'push',
        'pull_request',
        'installation',
        'installation_repositories',
      ],
    });
  }
}
