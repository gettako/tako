import { NextRequest, NextResponse } from 'next/server';
import { fetchServer, APIError } from '@/lib/api-client';
import { TraefikConfigFile, TraefikConfigFileContent } from '@/lib/types/node';

const FALLBACK_FILES: TraefikConfigFile[] = [
  {
    name: 'tako-console.yml',
    path: '/etc/tako/traefik/dynamic/tako-console.yml',
    size: 260,
    updatedAt: new Date().toISOString(),
    isCustom: false,
    type: 'yaml',
  },
  {
    name: 'security-headers.yml',
    path: '/etc/tako/traefik/dynamic/security-headers.yml',
    size: 275,
    updatedAt: new Date().toISOString(),
    isCustom: false,
    type: 'yaml',
  },
  {
    name: 'ratelimit.yml',
    path: '/etc/tako/traefik/dynamic/ratelimit.yml',
    size: 140,
    updatedAt: new Date().toISOString(),
    isCustom: false,
    type: 'yaml',
  },
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const files = await fetchServer<TraefikConfigFile[]>(`/api/v1/nodes/${id}/traefik/files`);
    return NextResponse.json(files);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Fallback for offline dev
    return NextResponse.json(FALLBACK_FILES);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const filename = body.name || body.filename;
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }
    const result = await fetchServer<TraefikConfigFileContent>(
      `/api/v1/nodes/${id}/traefik/files/${encodeURIComponent(filename)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: body.content ?? '' }),
      }
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to create Traefik config file' }, { status: 500 });
  }
}
