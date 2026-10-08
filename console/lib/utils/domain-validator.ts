/**
 * Domain & SSL validation and formatting utilities for Tako Console.
 */

const DOMAIN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export function sanitizeDomain(input: string): string {
  if (!input) return '';
  let d = input.trim();
  // Strip protocol
  d = d.replace(/^https?:\/\//i, '');
  // Strip path or query
  const slashIdx = d.indexOf('/');
  if (slashIdx !== -1) {
    d = d.substring(0, slashIdx);
  }
  // Strip port
  const colonIdx = d.indexOf(':');
  if (colonIdx !== -1) {
    d = d.substring(0, colonIdx);
  }
  return d.toLowerCase().trim();
}

export function validateDomain(input: string): { valid: boolean; error?: string } {
  const domain = sanitizeDomain(input);
  if (!domain) {
    return { valid: false, error: 'Domain name cannot be empty' };
  }

  if (domain === 'localhost') {
    return { valid: true };
  }

  if (domain.length < 3) {
    return { valid: false, error: 'Domain name is too short' };
  }

  if (domain.length > 253) {
    return { valid: false, error: 'Domain name cannot exceed 253 characters' };
  }

  if (domain.includes('..')) {
    return { valid: false, error: 'Domain cannot contain consecutive dots' };
  }

  if (!DOMAIN_REGEX.test(domain)) {
    return {
      valid: false,
      error: 'Invalid domain format. Please enter a valid FQDN (e.g. console.yourdomain.com)',
    };
  }

  const parts = domain.split('.');
  for (const part of parts) {
    if (part.startsWith('-') || part.endsWith('-')) {
      return { valid: false, error: 'Domain labels cannot start or end with a hyphen' };
    }
    if (part.length > 63) {
      return { valid: false, error: 'Domain label cannot exceed 63 characters' };
    }
  }

  return { valid: true };
}

export interface DnsPointerConfig {
  recordType: 'A' | 'CNAME';
  host: string;
  target: string;
  fqdn: string;
  ttl: number;
}

export function formatDnsInstructions(domain: string, targetIp: string): DnsPointerConfig {
  const sanitized = sanitizeDomain(domain) || 'console.gettako.dev';
  const parts = sanitized.split('.');
  let host = '@';
  if (parts.length > 2) {
    host = parts[0];
  }

  return {
    recordType: 'A',
    host,
    target: targetIp || '127.0.0.1',
    fqdn: sanitized,
    ttl: 300,
  };
}

export function getSslStatusBadge(
  status?: 'active' | 'pending_dns' | 'pending_acme' | 'error',
  sslActive?: boolean
): {
  label: string;
  variant: 'success' | 'warning' | 'info' | 'error';
  description: string;
} {
  if (sslActive || status === 'active') {
    return {
      label: 'TLS Active',
      variant: 'success',
      description: "Valid SSL/TLS certificate issued via Let's Encrypt ACME.",
    };
  }

  switch (status) {
    case 'pending_acme':
      return {
        label: 'ACME Challenge Pending',
        variant: 'info',
        description: 'DNS verified! Negotiating TLS certificate challenge with Let’s Encrypt via Traefik.',
      };
    case 'pending_dns':
      return {
        label: 'A Record Pending',
        variant: 'warning',
        description: 'DNS record does not point to cluster leader yet. ACME challenge blocked.',
      };
    case 'error':
      return {
        label: 'SSL Error',
        variant: 'error',
        description: 'Certificate verification failed. Check DNS propagation and port 80/443 reachability.',
      };
    default:
      return {
        label: 'Configured',
        variant: 'info',
        description: 'Domain saved. Run verification to validate DNS pointer and SSL handshake.',
      };
  }
}
