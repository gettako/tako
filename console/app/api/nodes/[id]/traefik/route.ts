import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await fetchServer(`/api/v1/nodes/${id}/traefik`);
    return NextResponse.json(config);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Fallback for offline local dev
    const { id } = await params;
    return NextResponse.json({
      nodeId: id,
      enabled: true,
      httpPort: 80,
      httpsPort: 443,
      dashboardEnabled: false,
      dashboardPort: 8080,
      acmeEmail: 'admin@gettako.dev',
      logLevel: 'INFO',
      accessLogEnabled: true,
      forceHttps: true,
      dynamicConfigDir: '/etc/tako/traefik/dynamic',
      certResolver: 'letsencrypt',
      metricsEnabled: true,
      lastReloadedAt: new Date().toISOString(),
      activeRoutersCount: 1,
      activeServicesCount: 1,
    });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await fetchServer(`/api/v1/nodes/${id}/traefik`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to update node Traefik configuration' }, { status: 500 });
  }
}
