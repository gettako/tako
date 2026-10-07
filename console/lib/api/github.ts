import type { GitHubAppManifest, GitHubAppConfig, SyncedRepo } from '../types';
import { simulateDelay } from './delay';
import { buildGitHubAppManifest } from '../utils/github-manifest';

export async function getGitHubAppManifest(customName?: string, customSlug?: string): Promise<GitHubAppManifest> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://console.gettako.dev';
  const appName = customName || 'Tako';
  const appSlug = customSlug || `tako-${Math.floor(10000 + Math.random() * 90000)}`;

  if (typeof window !== 'undefined') {
    try {
      const query = new URLSearchParams({
        baseUrl: origin,
        appName,
        appSlug,
      });
      const res = await fetch(`/api/github/manifest?${query.toString()}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback to client-generated manifest
    }
  }

  return buildGitHubAppManifest({ name: appName, slug: appSlug, baseUrl: origin });
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
    const res = await fetch('/api/github/manifest-conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      return await res.json();
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to convert manifest code with GitHub API');
  }

  throw new Error('Manifest conversion must be run in browser environment');
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

  return [];
}

export async function disconnectGitHubApp(): Promise<void> {
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/github/app', {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to disconnect GitHub App');
    }
  }
}
