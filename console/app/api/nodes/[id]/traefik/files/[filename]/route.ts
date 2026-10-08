import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';
import { TraefikConfigFileContent } from '@/lib/types/node';

const takoYamlContent = `# Dynamic configuration for Tako reverse proxy
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
`;

const FALLBACK_FILE_CONTENTS: Record<string, string> = {
  'tako.yml': takoYamlContent,
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
    if (filename in FALLBACK_FILE_CONTENTS) {
      const content = FALLBACK_FILE_CONTENTS[filename];
      return NextResponse.json({
        name: filename,
        path: `/etc/tako/traefik/dynamic/${filename}`,
        size: content.length,
        updatedAt: new Date().toISOString(),
        isCustom: false,
        type: 'yaml',
        content,
      });
    }
    return NextResponse.json({ error: `File '${filename}' not found` }, { status: 404 });
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
