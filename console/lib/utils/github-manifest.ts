import type { GitHubAppManifest } from '../types';

export interface GenerateManifestOptions {
  name?: string;
  slug?: string;
  baseUrl?: string;
}

export function buildGitHubAppManifest(options: GenerateManifestOptions = {}): GitHubAppManifest {
  const origin = (options.baseUrl || 'https://console.gettako.dev').replace(/\/+$/, '');
  const appName = options.name || 'Tako';
  const appSlug = options.slug || (options.name && options.name.startsWith('tako-') ? options.name : `tako-${Math.floor(10000 + Math.random() * 90000)}`);
  const manifestName = (options.name && options.name !== 'Tako' && options.name !== 'Takō') ? options.name : (options.slug || appSlug);

  let webhookUrl = `${origin}/api/webhooks/github`;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    webhookUrl = 'https://console.gettako.dev/api/webhooks/github';
  }

  return {
    name: manifestName,
    description: `${appName} Cloud Infrastructure & Automated Deployments`,
    url: origin,
    hook_attributes: {
      url: webhookUrl,
      active: true,
    },
    redirect_url: `${origin}/settings?tab=git&setup=github`,
    callback_urls: [`${origin}/api/auth/callback/github`],
    public: true,
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
    ],
  };
}
