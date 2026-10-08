import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';
import { TraefikConfigFileContent } from '@/lib/types/node';

const FALLBACK_FILE_CONTENTS: Record<string, string> = {
  'tako-console.yml': `# Dynamic configuration for Tako Console reverse proxy
http:
  routers:
    tako-console:
      rule: "PathPrefix(\`/\`)"
      service: tako-console-svc
      entryPoints:
        - web
        - websecure
      tls:
        certResolver: letsencrypt
  services:
    tako-console-svc:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3000"
`,
  'security-headers.yml': `# Security headers middleware
http:
  middlewares:
    secure-headers:
      headers:
        sslRedirect: true
        forceSTSHeader: true
        stsIncludeSubdomains: true
        stsPreload: true
        stsSeconds: 31536000
        customFrameOptionsValue: "SAMEORIGIN"
        contentTypeNosniff: true
        browserXssFilter: true
`,
  'ratelimit.yml': `# Rate limiting middleware template
http:
  middlewares:
    api-ratelimit:
      rateLimit:
        average: 100
        burst: 50
        period: 1m
`,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    const { id, filename } = await params;
    const file = await fetchServer<TraefikConfigFileContent>(
      `/api/v1/nodes/${id}/traefik/files/${encodeURIComponent(filename)}`
    );
    return NextResponse.json(file);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { filename } = await params;
    const content = FALLBACK_FILE_CONTENTS[filename] ?? '# Custom dynamic configuration\n';
    return NextResponse.json({
      name: filename,
      path: `/etc/tako/traefik/dynamic/${filename}`,
      size: content.length,
      updatedAt: new Date().toISOString(),
      isCustom: !FALLBACK_FILE_CONTENTS[filename],
      type: filename.endsWith('.toml') ? 'toml' : filename.endsWith('.json') ? 'json' : 'yaml',
      content,
    });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    const { id, filename } = await params;
    const body = await req.json();
    const result = await fetchServer<TraefikConfigFileContent>(
      `/api/v1/nodes/${id}/traefik/files/${encodeURIComponent(filename)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to save Traefik config file' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    const { id, filename } = await params;
    const result = await fetchServer<{ success: boolean; name: string }>(
      `/api/v1/nodes/${id}/traefik/files/${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
      }
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to delete Traefik config file' }, { status: 500 });
  }
}
