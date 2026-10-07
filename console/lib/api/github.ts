import type { GitHubAppManifest, GitHubAppConfig, SyncedRepo } from '../types';
import { simulateDelay } from './delay';
import { buildGitHubAppManifest } from '../utils/github-manifest';

export async function getGitHubAppManifest(customName?: string): Promise<GitHubAppManifest> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://console.gettako.dev';
  const appName = customName || `Takō Cloud (${typeof window !== 'undefined' ? window.location.hostname : 'Local'})`;

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/github/manifest?baseUrl=${encodeURIComponent(origin)}&appName=${encodeURIComponent(appName)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback to client-generated manifest
    }
  }

  return buildGitHubAppManifest({ name: appName, baseUrl: origin });
}

export function submitGitHubAppManifestForm(manifest: GitHubAppManifest, targetOrg?: string): void {
  if (typeof window === 'undefined') return;

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = targetOrg && targetOrg.trim()
    ? `https://github.com/organizations/${encodeURIComponent(targetOrg.trim())}/settings/apps/new`
    : 'https://github.com/settings/apps/new';
  form.target = '_self';

  const manifestInput = document.createElement('input');
  manifestInput.type = 'hidden';
  manifestInput.name = 'manifest';
  manifestInput.value = JSON.stringify(manifest);

  form.appendChild(manifestInput);
  document.body.appendChild(form);
  form.submit();
}

export async function convertGitHubAppManifestCode(code: string): Promise<GitHubAppConfig> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/github/manifest-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        return await res.json();
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to convert manifest code');
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        throw err;
      }
    }
  }

  // Fallback for mock/preview
  await simulateDelay(300, 600);
  const slug = `tako-cloud-${Date.now().toString(36)}`;
  return {
    appId: 100000 + Math.floor(Math.random() * 900000),
    slug,
    name: 'Takō Cloud (Automated App)',
    clientId: `Iv1.${Math.random().toString(36).substring(2, 10)}`,
    htmlUrl: `https://github.com/apps/${slug}`,
    installUrl: `https://github.com/apps/${slug}/installations/new`,
    owner: {
      login: 'SupianIDz',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1000001?v=4',
      type: 'User',
      htmlUrl: 'https://github.com/SupianIDz',
    },
    installations: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getGitHubAppConfig(): Promise<GitHubAppConfig | null> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/github/app');
      if (res.ok) {
        const data = await res.json();
        if (data && data.connected) {
          return data;
        }
      }
    } catch {
      // fallback
    }
  }

  await simulateDelay(50, 100);
  return null;
}

export async function syncGitHubInstallation(installationId?: number): Promise<SyncedRepo[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/github/installations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installationId }),
      });
      if (res.ok) {
        const repos = await res.json();
        if (Array.isArray(repos)) {
          return repos;
        }
      }
    } catch {
      // fallback
    }
  }

  await simulateDelay(300, 500);
  return [];
}

export async function disconnectGitHubApp(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/github/app', {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to disconnect GitHub App');
      }
      return;
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        throw err;
      }
    }
  }

  await simulateDelay(200, 400);
}
