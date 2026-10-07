import type { GitHubAppManifest } from '../types';

export interface GenerateManifestOptions {
  name?: string;
  baseUrl?: string;
}

export function buildGitHubAppManifest(options: GenerateManifestOptions = {}): GitHubAppManifest {
  const origin = (options.baseUrl || 'https://console.gettako.dev').replace(/\/+$/, '');
  const appName = options.name || 'Takō Cloud';

  return {
    name: appName,
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
  };
}
