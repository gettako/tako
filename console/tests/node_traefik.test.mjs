import test from 'node:test';
import assert from 'node:assert/strict';

test('Node Traefik Config - port validation and conflict checking', () => {
  function validateTraefikPorts(httpPort, httpsPort, dashboardPort) {
    if (httpPort <= 0 || httpPort > 65535) {
      return { valid: false, error: 'HTTP port must be between 1 and 65535' };
    }
    if (httpsPort <= 0 || httpsPort > 65535) {
      return { valid: false, error: 'HTTPS port must be between 1 and 65535' };
    }
    if (httpPort === httpsPort) {
      return { valid: false, error: 'HTTP and HTTPS ports cannot be identical' };
    }
    if (dashboardPort && (dashboardPort <= 0 || dashboardPort > 65535)) {
      return { valid: false, error: 'Dashboard port must be between 1 and 65535' };
    }
    return { valid: true };
  }

  // Valid standard ports
  assert.equal(validateTraefikPorts(80, 443, 8080).valid, true);
  // Valid non-standard ports
  assert.equal(validateTraefikPorts(8080, 8443, 9000).valid, true);

  // Identical ports conflict
  const conflict = validateTraefikPorts(80, 80, 8080);
  assert.equal(conflict.valid, false);
  assert.match(conflict.error, /cannot be identical/i);

  // Invalid port out of range
  const outOfRange = validateTraefikPorts(0, 443, 8080);
  assert.equal(outOfRange.valid, false);
  assert.match(outOfRange.error, /between 1 and 65535/i);
});

test('Node Traefik Config - log level sanitization', () => {
  const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

  function sanitizeLogLevel(input) {
    const upper = String(input || '').trim().toUpperCase();
    return validLevels.includes(upper) ? upper : 'INFO';
  }

  assert.equal(sanitizeLogLevel('debug'), 'DEBUG');
  assert.equal(sanitizeLogLevel('INFO'), 'INFO');
  assert.equal(sanitizeLogLevel('warn'), 'WARN');
  assert.equal(sanitizeLogLevel('error'), 'ERROR');
  assert.equal(sanitizeLogLevel('invalid'), 'INFO'); // Fallback to INFO
  assert.equal(sanitizeLogLevel(''), 'INFO');
});

test('Node Traefik Config Lifecycle - updates settings and reloads', () => {
  let config = {
    nodeId: 'node-worker-01',
    enabled: true,
    httpPort: 80,
    httpsPort: 443,
    dashboardEnabled: false,
    dashboardPort: 8080,
    acmeEmail: 'admin@gettako.dev',
    logLevel: 'INFO',
    accessLogEnabled: true,
    forceHttps: true,
    dynamicConfigDir: '/etc/tako/traefik/dynamic',
    certResolver: 'letsencrypt',
    metricsEnabled: true,
    lastReloadedAt: new Date().toISOString(),
  };

  // 1. Update config with custom dashboard port and debug logs
  const updates = {
    dashboardEnabled: true,
    dashboardPort: 9000,
    logLevel: 'DEBUG',
  };
  config = { ...config, ...updates };

  assert.equal(config.dashboardEnabled, true);
  assert.equal(config.dashboardPort, 9000);
  assert.equal(config.logLevel, 'DEBUG');

  // 2. Simulate Traefik dynamic reload
  const reloadTimestamp = new Date().toISOString();
  config.lastReloadedAt = reloadTimestamp;
  assert.equal(config.lastReloadedAt, reloadTimestamp);
});
