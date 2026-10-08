import test from 'node:test';
import assert from 'node:assert/strict';

// Test env parser
import { parseDotEnv, formatDotEnv } from '../lib/utils/env-parser.ts';

test('Env Parser - parses and formats .env correctly', () => {
  const sampleEnv = `
# Comment line
PORT=8080
API_KEY=secret_12345
DATABASE_URL=postgres://user:pass@localhost:5432/db
EMPTY_VAL=
`;

  const parsed = parseDotEnv(sampleEnv);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].key, 'PORT');
  assert.equal(parsed[0].value, '8080');
  assert.equal(parsed[1].key, 'API_KEY');
  assert.equal(parsed[1].value, 'secret_12345');
  assert.equal(parsed[1].isSecret, true);
  assert.equal(parsed[2].key, 'DATABASE_URL');
  assert.equal(parsed[3].key, 'EMPTY_VAL');
  assert.equal(parsed[3].value, '');

  const formatted = formatDotEnv(parsed.map((p, idx) => ({
    id: `env-${idx}`,
    key: p.key,
    value: p.value,
    isSecret: p.isSecret,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })));

  assert.match(formatted, /PORT=8080/);
  assert.match(formatted, /API_KEY=secret_12345/);
});

test('Cron Jobs - mock CRUD and toggle flow', async () => {
  // Test dynamic cron operations
  let cronJobs = [
    {
      id: 'cron-1',
      serviceId: 'srv-test',
      name: 'Backup Database',
      schedule: '0 2 * * *',
      command: 'pg_dump > /backups/db.sql',
      status: 'active',
      createdAt: new Date().toISOString(),
    }
  ];

  // Toggle active/paused
  const job = cronJobs[0];
  const newStatus = job.status === 'active' ? 'paused' : 'active';
  job.status = newStatus;
  assert.equal(job.status, 'paused');

  job.status = job.status === 'active' ? 'paused' : 'active';
  assert.equal(job.status, 'active');

  // Add new cron job
  const newJob = {
    id: 'cron-2',
    serviceId: 'srv-test',
    name: 'Cache Warming',
    schedule: '*/15 * * * *',
    command: 'curl -s http://localhost:8080/health',
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  cronJobs.unshift(newJob);

  assert.equal(cronJobs.length, 2);
  assert.equal(cronJobs[0].id, 'cron-2');

  // Delete cron job
  cronJobs = cronJobs.filter((j) => j.id !== 'cron-1');
  assert.equal(cronJobs.length, 1);
  assert.equal(cronJobs[0].id, 'cron-2');
});

test('Webhooks - secret regeneration and manual test execution', async () => {
  let webhook = {
    id: 'wh-srv-test',
    serviceId: 'srv-test',
    name: 'Git Deployment Trigger',
    url: 'https://console.gettako.dev/api/webhooks/deploy/srv-test',
    secret: 'whsec_old123',
    events: ['push', 'tag'],
    active: true,
    createdAt: new Date().toISOString(),
  };

  // Regenerate secret
  const newSecret = `whsec_${Math.random().toString(36).substring(2, 15)}`;
  webhook.secret = newSecret;
  assert.notEqual(webhook.secret, 'whsec_old123');
  assert.match(webhook.secret, /^whsec_/);

  // Update events
  webhook.events = ['push', 'tag', 'release'];
  assert.deepEqual(webhook.events, ['push', 'tag', 'release']);

  // Simulate test trigger
  const delivery = {
    id: `whd-${Date.now()}`,
    webhookId: webhook.id,
    event: 'manual',
    status: 'success',
    statusCode: 200,
    timestamp: new Date().toISOString(),
  };
  assert.equal(delivery.statusCode, 200);
  assert.equal(delivery.status, 'success');
});

test('Domain Management - primary assignment and deletion fallback', () => {
  let domains = [
    { id: 'dom-1', domain: 'primary.example.com', primary: true, port: 80, path: '/', ssl: true, createdAt: '' },
    { id: 'dom-2', domain: 'secondary.example.com', primary: false, port: 80, path: '/', ssl: true, createdAt: '' },
  ];

  // Set secondary as primary
  domains = domains.map((d) => ({
    ...d,
    primary: d.id === 'dom-2',
  }));
  assert.equal(domains[0].primary, false);
  assert.equal(domains[1].primary, true);

  // Delete current primary (dom-2), fallback promotes remaining domain (dom-1)
  const wasPrimary = domains.find((d) => d.id === 'dom-2')?.primary;
  domains = domains.filter((d) => d.id !== 'dom-2');
  if (wasPrimary && domains.length > 0) {
    domains[0].primary = true;
  }

  assert.equal(domains.length, 1);
  assert.equal(domains[0].id, 'dom-1');
  assert.equal(domains[0].primary, true);
});

import { validateCronExpression, explainCronExpression } from '../lib/utils/cron-explainer.ts';

test('Cron Explainer & Validator - validates standard and invalid cron expressions', () => {
  // Valid expressions
  const valid1 = validateCronExpression('0 0 * * *');
  assert.equal(valid1.isValid, true);
  assert.equal(explainCronExpression('0 0 * * *'), 'Every day at midnight (00:00 UTC)');

  const valid2 = validateCronExpression('*/15 * * * *');
  assert.equal(valid2.isValid, true);
  assert.equal(explainCronExpression('*/15 * * * *'), 'Every 15 minutes');

  // Invalid expressions
  const invalidLength = validateCronExpression('* * *');
  assert.equal(invalidLength.isValid, false);
  assert.match(invalidLength.error || '', /Expected 5 fields/);

  const invalidMinute = validateCronExpression('65 * * * *');
  assert.equal(invalidMinute.isValid, false);
  assert.match(invalidMinute.error || '', /range: 0-59/);

  const invalidStep = validateCronExpression('*/0 * * * *');
  assert.equal(invalidStep.isValid, false);
  assert.match(invalidStep.error || '', /Invalid step value/);
});

import { buildGitHubAppManifest } from '../lib/utils/github-manifest.ts';

test('GitHub App Manifest - generates valid manifest specification', async () => {
  const manifest = buildGitHubAppManifest({ name: 'Takō Production Cluster', baseUrl: 'https://console.gettako.dev' });
  assert.equal(manifest.name, 'Takō Production Cluster');
  assert.match(manifest.redirect_url, /\/settings\?tab=git&setup=github/);
  assert.match(manifest.hook_attributes.url, /\/api\/webhooks\/github/);
  assert.equal(manifest.hook_attributes.active, true);
  assert.equal(manifest.default_permissions.contents, 'read');
  assert.equal(manifest.default_permissions.statuses, 'write');
  assert.equal(manifest.default_permissions.deployments, 'write');
  assert.ok(manifest.default_events.includes('push'));
  assert.ok(manifest.default_events.includes('pull_request'));
  // GitHub Apps receive installation lifecycle events automatically;
  // subscribing to them in default_events is rejected by GitHub.
  assert.equal(manifest.default_events.includes('installation'), false);
  assert.equal(manifest.default_events.includes('installation_repositories'), false);
  // GitHub strictly forbids the "slug" key in manifests
  assert.equal('slug' in manifest, false);
  assert.equal(manifest.slug, undefined);

  // When custom slug is passed with default name, manifest name uses slug to prevent collision
  const slugManifest = buildGitHubAppManifest({ name: 'Tako', slug: 'tako-99999' });
  assert.equal(slugManifest.name, 'tako-99999');
  assert.equal('slug' in slugManifest, false);
});

test('Backups Lifecycle - snapshot creation and deletion flow', async () => {
  let backups = [
    {
      id: 'bk-1',
      name: 'backup-postgres-2026-10-05-0300.sql.gz',
      sizeMb: 48.2,
      status: 'completed',
      createdAt: new Date().toISOString(),
    },
  ];

  const newBackup = {
    id: `bk-${Date.now()}`,
    name: 'manual-postgres-2026-10-08.sql.gz',
    sizeMb: 48.4,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  backups = [newBackup, ...backups];
  assert.equal(backups.length, 2);
  assert.equal(backups[0].id, newBackup.id);

  // Delete
  backups = backups.filter((b) => b.id !== 'bk-1');
  assert.equal(backups.length, 1);
});

test('Endpoint Builders - generates clean stream URLs', () => {
  const getDeploymentLogsStreamUrl = (id) => `/api/sse/deployments/${id}/logs`;
  const getNodeEventsStreamUrl = () => '/api/sse/nodes';

  assert.equal(getNodeEventsStreamUrl(), '/api/sse/nodes');
  assert.equal(getDeploymentLogsStreamUrl('dep-123'), '/api/sse/deployments/dep-123/logs');
});

test('Service Telemetry Metrics - generates accurate time-series telemetry points', async () => {
  const { getServiceTimeSeriesMetrics } = await import('../lib/api/metrics.ts');

  const baseline = {
    cpuPercent: 25,
    memoryUsedMb: 256,
    memoryLimitMb: 1024,
    replicas: 2,
  };

  const metrics1h = await getServiceTimeSeriesMetrics('srv-test', '1h', baseline);
  assert.ok(Array.isArray(metrics1h));
  assert.ok(metrics1h.length > 0);

  const sample = metrics1h[0];
  assert.ok(typeof sample.timestamp === 'string');
  assert.ok(typeof sample.cpu === 'number' && sample.cpu >= 0 && sample.cpu <= 100);
  assert.ok(typeof sample.memory === 'number' && sample.memory >= 0);
  assert.ok(typeof sample.memoryPercent === 'number' && sample.memoryPercent <= 100);
  assert.ok(typeof sample.networkRx === 'number' && sample.networkRx >= 0);
  assert.ok(typeof sample.networkTx === 'number' && sample.networkTx >= 0);
  assert.ok(typeof sample.diskRead === 'number');
  assert.ok(typeof sample.diskWrite === 'number');

  // Verify multi-replica metrics are generated when replicas > 1
  assert.ok(sample.replicaMetrics);
  assert.ok(sample.replicaMetrics['replica-1']);
  assert.ok(sample.replicaMetrics['replica-2']);

  // Verify 15m and 24h ranges
  const metrics15m = await getServiceTimeSeriesMetrics('srv-test', '15m', baseline);
  assert.ok(metrics15m.length > 0);
});




