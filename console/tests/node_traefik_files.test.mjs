import test from 'node:test';
import assert from 'node:assert/strict';

test('Node Traefik Files - filename security and format validation', () => {
  function isValidTraefikFilename(name) {
    if (!name || typeof name !== 'string' || name.length > 64) {
      return false;
    }
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      return false;
    }
    const lower = name.toLowerCase();
    if (
      !lower.endsWith('.yml') &&
      !lower.endsWith('.yaml') &&
      !lower.endsWith('.toml') &&
      !lower.endsWith('.json')
    ) {
      return false;
    }
    for (const ch of name) {
      const isAlpha = (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
      const isDigit = ch >= '0' && ch <= '9';
      const isAllowed = isAlpha || isDigit || ch === '-' || ch === '_' || ch === '.';
      if (!isAllowed) {
        return false;
      }
    }
    return true;
  }

  // Valid filenames
  assert.equal(isValidTraefikFilename('tako-console.yml'), true);
  assert.equal(isValidTraefikFilename('security-headers.yaml'), true);
  assert.equal(isValidTraefikFilename('ratelimit.toml'), true);
  assert.equal(isValidTraefikFilename('api-routes.json'), true);
  assert.equal(isValidTraefikFilename('custom_service-01.yml'), true);

  // Path traversal attacks must be rejected
  assert.equal(isValidTraefikFilename('../passwd.yml'), false);
  assert.equal(isValidTraefikFilename('../../etc/shadow'), false);
  assert.equal(isValidTraefikFilename('sub/dir/config.yml'), false);
  assert.equal(isValidTraefikFilename('..\\windows.yaml'), false);

  // Invalid extensions
  assert.equal(isValidTraefikFilename('script.sh'), false);
  assert.equal(isValidTraefikFilename('config.exe'), false);
  assert.equal(isValidTraefikFilename('test.txt'), false);
  assert.equal(isValidTraefikFilename('no-extension'), false);

  // Empty or invalid characters
  assert.equal(isValidTraefikFilename(''), false);
  assert.equal(isValidTraefikFilename('bad name with spaces.yml'), false);
  assert.equal(isValidTraefikFilename('dangerous;command.yml'), false);
});

test('Node Traefik Files - file type detection', () => {
  function getTraefikFileType(name) {
    const lower = name.toLowerCase();
    if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml';
    if (lower.endsWith('.toml')) return 'toml';
    if (lower.endsWith('.json')) return 'json';
    return 'yaml';
  }

  assert.equal(getTraefikFileType('service.yml'), 'yaml');
  assert.equal(getTraefikFileType('service.yaml'), 'yaml');
  assert.equal(getTraefikFileType('traefik.toml'), 'toml');
  assert.equal(getTraefikFileType('rules.json'), 'json');
});

test('Node Traefik Files - in-memory storage, edit, save, and delete lifecycle', () => {
  const store = new Map();

  // Seed default files
  store.set('tako-console.yml', {
    name: 'tako-console.yml',
    path: '/etc/tako/traefik/dynamic/tako-console.yml',
    size: 260,
    updatedAt: new Date().toISOString(),
    isCustom: false,
    type: 'yaml',
    content: 'http:\n  routers:\n    console:\n      rule: PathPrefix(`/`)\n',
  });

  store.set('security-headers.yml', {
    name: 'security-headers.yml',
    path: '/etc/tako/traefik/dynamic/security-headers.yml',
    size: 200,
    updatedAt: new Date().toISOString(),
    isCustom: false,
    type: 'yaml',
    content: 'http:\n  middlewares:\n    secure-headers:\n      headers:\n        sslRedirect: true\n',
  });

  // 1. List files
  assert.equal(store.size, 2);
  assert.equal(store.has('tako-console.yml'), true);

  // 2. Read file content
  const consoleFile = store.get('tako-console.yml');
  assert.ok(consoleFile.content.includes('PathPrefix'));

  // 3. Edit existing file
  const editedContent = 'http:\n  routers:\n    console:\n      rule: Host(`dashboard.gettako.dev`)\n';
  store.set('tako-console.yml', {
    ...consoleFile,
    content: editedContent,
    size: editedContent.length,
    updatedAt: new Date().toISOString(),
  });
  assert.equal(store.get('tako-console.yml').content, editedContent);
  assert.equal(store.get('tako-console.yml').size, editedContent.length);

  // 4. Create new custom dynamic configuration file
  const customFile = {
    name: 'my-microservice.yml',
    path: '/etc/tako/traefik/dynamic/my-microservice.yml',
    size: 150,
    updatedAt: new Date().toISOString(),
    isCustom: true,
    type: 'yaml',
    content: 'http:\n  routers:\n    microservice:\n      rule: Host(`api.example.com`)\n      service: svc\n',
  };
  store.set(customFile.name, customFile);

  assert.equal(store.size, 3);
  assert.equal(store.get('my-microservice.yml').isCustom, true);

  // 5. Delete file
  store.delete('my-microservice.yml');
  assert.equal(store.size, 2);
  assert.equal(store.has('my-microservice.yml'), false);
});

test('Node Traefik Files - format cleaner utility', () => {
  function cleanTrailingWhitespace(raw) {
    return raw
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  const dirty = 'http:    \n  routers:  \n\n\n\n  services: \n';
  const cleaned = cleanTrailingWhitespace(dirty);

  assert.equal(cleaned.includes('    \n'), false);
  assert.equal(cleaned.includes('\n\n\n'), false);
});
