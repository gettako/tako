import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeDomain,
  validateDomain,
  formatDnsInstructions,
  getSslStatusBadge,
} from '../lib/utils/domain-validator.ts';

test('Cluster Domain Validator - sanitizes protocol, ports, and paths', () => {
  assert.equal(sanitizeDomain('https://console.gettako.dev/'), 'console.gettako.dev');
  assert.equal(sanitizeDomain('http://APP.EXAMPLE.COM:8080/dashboard?tab=1'), 'app.example.com');
  assert.equal(sanitizeDomain('  my-cluster.tako.io  '), 'my-cluster.tako.io');
  assert.equal(sanitizeDomain(''), '');
});

test('Cluster Domain Validator - validates domain syntax correctly', () => {
  // Valid domains
  assert.equal(validateDomain('console.gettako.dev').valid, true);
  assert.equal(validateDomain('app.internal.cloud.org').valid, true);
  assert.equal(validateDomain('sub-domain.example.co.id').valid, true);
  assert.equal(validateDomain('localhost').valid, true);

  // Invalid domains
  assert.equal(validateDomain('').valid, false);
  assert.equal(validateDomain('a').valid, false); // too short
  assert.equal(validateDomain('invalid..domain.com').valid, false); // consecutive dots
  assert.equal(validateDomain('-invalid.domain.com').valid, false); // leading hyphen
  assert.equal(validateDomain('invalid-.domain.com').valid, false); // trailing hyphen
  assert.equal(validateDomain('domain with spaces.com').valid, false);
  assert.equal(validateDomain('https://console.gettako.dev').valid, true); // sanitized automatically
});

test('Cluster Domain DNS Instructions - generates accurate DNS records', () => {
  const leaderIp = '43.156.243.241';

  // Subdomain
  const subDns = formatDnsInstructions('console.gettako.dev', leaderIp);
  assert.equal(subDns.recordType, 'A');
  assert.equal(subDns.host, 'console');
  assert.equal(subDns.target, leaderIp);
  assert.equal(subDns.fqdn, 'console.gettako.dev');
  assert.equal(subDns.ttl, 300);

  // Root or 2-level domain
  const rootDns = formatDnsInstructions('gettako.dev', leaderIp);
  assert.equal(rootDns.recordType, 'A');
  assert.equal(rootDns.host, '@');
  assert.equal(rootDns.target, leaderIp);
});

test('SSL Status Badge - reflects accurate certificate states', () => {
  const active = getSslStatusBadge('active', true);
  assert.equal(active.label, 'TLS Active');
  assert.equal(active.variant, 'success');

  const pendingDns = getSslStatusBadge('pending_dns', false);
  assert.equal(pendingDns.label, 'A Record Pending');
  assert.equal(pendingDns.variant, 'warning');

  const pendingAcme = getSslStatusBadge('pending_acme', false);
  assert.equal(pendingAcme.label, 'ACME Challenge Pending');
  assert.equal(pendingAcme.variant, 'info');

  const sslError = getSslStatusBadge('error', false);
  assert.equal(sslError.label, 'SSL Error');
  assert.equal(sslError.variant, 'error');
});

test('Cluster Domain Settings Lifecycle - simulates domain update and DNS matching', () => {
  let settings = {
    domain: 'console.gettako.dev',
    sslActive: true,
    sslAutoRenew: true,
    customDnsIp: '',
    sslStatus: 'active',
  };

  const detectedLeaderIp = '43.156.243.241';

  // 1. Update domain to new custom host
  const newDomain = sanitizeDomain('https://cluster.mycompany.com/');
  const validation = validateDomain(newDomain);
  assert.equal(validation.valid, true);

  settings = {
    ...settings,
    domain: newDomain,
    sslStatus: 'pending_dns',
    sslActive: false,
  };
  assert.equal(settings.domain, 'cluster.mycompany.com');
  assert.equal(settings.sslActive, false);

  // 2. Simulate DNS check mismatch
  const resolvedIps = ['1.1.1.1'];
  const isMatch = resolvedIps.includes(detectedLeaderIp);
  assert.equal(isMatch, false);

  // 3. Simulate DNS pointing to leader IP
  const resolvedPropagatedIps = ['43.156.243.241'];
  const isPropagated = resolvedPropagatedIps.includes(detectedLeaderIp);
  assert.equal(isPropagated, true);

  // 4. Update status after successful verification
  settings.sslStatus = 'active';
  settings.sslActive = true;
  settings.dnsVerified = true;
  assert.equal(settings.sslActive, true);
  assert.equal(settings.dnsVerified, true);
});
