import { NextRequest, NextResponse } from 'next/server';
import { GitProvider, SyncedRepo } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const provider = body.provider as 'github' | 'gitlab' | 'gitea';
    const token = (body.token || '').trim();
    const baseUrl = (body.baseUrl || '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Personal Access Token is required' }, { status: 400 });
    }

    if (provider === 'github') {
      // 1. Verify user identity with GitHub
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Tako-Git-Client',
        },
      });

      if (!userRes.ok) {
        return NextResponse.json(
          { error: 'Invalid GitHub Personal Access Token or insufficient permissions (HTTP 401)' },
          { status: 401 }
        );
      }

      const ghUser = await userRes.json();
      const username = ghUser.login || body.username || 'github-user';

      // 2. Fetch authenticated user's repositories
      const reposRes = await fetch(
        'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Tako-Git-Client',
          },
        }
      );

      const rawRepos = reposRes.ok ? await reposRes.json() : [];
      const providerId = `git-github-${username}`;

      const gitProvider: GitProvider = {
        id: providerId,
        type: 'github',
        name: `GitHub (${username})`,
        username,
        connected: true,
        avatarUrl: ghUser.avatar_url || `https://github.com/${username}.png`,
        connectedAt: new Date().toISOString(),
      };

      const repos: SyncedRepo[] = Array.isArray(rawRepos)
        ? rawRepos.map((r: Record<string, unknown>) => ({
            id: `gh-${r.id}`,
            providerId,
            name: String(r.name || ''),
            fullName: String(r.full_name || ''),
            defaultBranch: String(r.default_branch || 'main'),
            private: Boolean(r.private),
            htmlUrl: String(r.html_url || ''),
            updatedAt: String(r.updated_at || new Date().toISOString()),
          }))
        : [];

      return NextResponse.json({ provider: gitProvider, repos });
    }

    if (provider === 'gitlab') {
      const glBase = (baseUrl || 'https://gitlab.com').replace(/\/+$/, '');
      const userRes = await fetch(`${glBase}/api/v4/user`, {
        headers: {
          'PRIVATE-TOKEN': token,
          'User-Agent': 'Tako-Git-Client',
        },
      });

      if (!userRes.ok) {
        return NextResponse.json(
          { error: 'Invalid GitLab Personal Access Token or host unreachable' },
          { status: 401 }
        );
      }

      const glUser = await userRes.json();
      const username = glUser.username || body.username || 'gitlab-user';
      const providerId = `git-gitlab-${username}`;

      const reposRes = await fetch(
        `${glBase}/api/v4/projects?membership=true&per_page=100&order_by=updated_at`,
        {
          headers: {
            'PRIVATE-TOKEN': token,
            'User-Agent': 'Tako-Git-Client',
          },
        }
      );

      const rawRepos = reposRes.ok ? await reposRes.json() : [];

      const gitProvider: GitProvider = {
        id: providerId,
        type: 'gitlab',
        name: `GitLab (${username})`,
        username,
        connected: true,
        avatarUrl: glUser.avatar_url,
        connectedAt: new Date().toISOString(),
      };

      const repos: SyncedRepo[] = Array.isArray(rawRepos)
        ? rawRepos.map((r: Record<string, unknown>) => ({
            id: `gl-${r.id}`,
            providerId,
            name: String(r.name || ''),
            fullName: String(r.path_with_namespace || r.name || ''),
            defaultBranch: String(r.default_branch || 'main'),
            private: r.visibility === 'private',
            htmlUrl: String(r.web_url || ''),
            updatedAt: String(r.last_activity_at || new Date().toISOString()),
          }))
        : [];

      return NextResponse.json({ provider: gitProvider, repos });
    }

    if (provider === 'gitea') {
      const giteaBase = (baseUrl || 'https://gitea.com').replace(/\/+$/, '');
      const userRes = await fetch(`${giteaBase}/api/v1/user`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/json',
          'User-Agent': 'Tako-Git-Client',
        },
      });

      if (!userRes.ok) {
        return NextResponse.json(
          { error: 'Invalid Gitea Access Token or server unreachable' },
          { status: 401 }
        );
      }

      const giteaUser = await userRes.json();
      const username = giteaUser.username || body.username || 'gitea-user';
      const providerId = `git-gitea-${username}`;

      const reposRes = await fetch(`${giteaBase}/api/v1/user/repos?limit=100`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/json',
          'User-Agent': 'Tako-Git-Client',
        },
      });

      const rawRepos = reposRes.ok ? await reposRes.json() : [];

      const gitProvider: GitProvider = {
        id: providerId,
        type: 'github',
        name: `Gitea (${username})`,
        username,
        connected: true,
        avatarUrl: giteaUser.avatar_url,
        connectedAt: new Date().toISOString(),
      };

      const repos: SyncedRepo[] = Array.isArray(rawRepos)
        ? rawRepos.map((r: Record<string, unknown>) => ({
            id: `gt-${r.id}`,
            providerId,
            name: String(r.name || ''),
            fullName: String(r.full_name || r.name || ''),
            defaultBranch: String(r.default_branch || 'main'),
            private: Boolean(r.private),
            htmlUrl: String(r.html_url || ''),
            updatedAt: String(r.updated_at || new Date().toISOString()),
          }))
        : [];

      return NextResponse.json({ provider: gitProvider, repos });
    }

    return NextResponse.json({ error: 'Unsupported git provider' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to connect Git provider';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
