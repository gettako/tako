import test from 'node:test';
import assert from 'node:assert/strict';

test('S3 Bucket Manager - validates endpoint URL and bucket names', () => {
  const isValidEndpoint = (ep) => {
    try {
      const url = new URL(ep);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isValidBucketName = (name) => {
    return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name);
  };

  assert.equal(isValidEndpoint('https://r2.cloudflarestorage.com'), true);
  assert.equal(isValidEndpoint('http://localhost:9000'), true);
  assert.equal(isValidEndpoint('ftp://ftp.example.com'), false);
  assert.equal(isValidEndpoint('invalid-url'), false);

  assert.equal(isValidBucketName('tako-production-backups'), true);
  assert.equal(isValidBucketName('my-bucket.2026'), true);
  assert.equal(isValidBucketName('a'), false); // too short
  assert.equal(isValidBucketName('INVALID_CAPS'), false); // uppercase not standard
});

test('S3 Bucket Lifecycle - adds, updates, sets default, and deletes', () => {
  let buckets = [];

  const addBucket = (input) => {
    const isFirst = buckets.length === 0;
    const shouldDefault = input.isDefault ?? isFirst;
    if (shouldDefault) {
      buckets = buckets.map((b) => ({ ...b, isDefault: false }));
    }
    const newB = {
      ...input,
      id: `s3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isDefault: shouldDefault,
      createdAt: new Date().toISOString(),
    };
    buckets.push(newB);
    return newB;
  };

  const updateBucket = (id, patch) => {
    const idx = buckets.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error('Not found');
    if (patch.isDefault) {
      buckets = buckets.map((b) => ({ ...b, isDefault: false }));
    }
    buckets[idx] = { ...buckets[idx], ...patch };
    return buckets[idx];
  };

  const setDefaultBucket = (id) => {
    buckets = buckets.map((b) => ({ ...b, isDefault: b.id === id }));
  };

  const deleteBucket = (id) => {
    const wasDefault = buckets.find((b) => b.id === id)?.isDefault;
    buckets = buckets.filter((b) => b.id !== id);
    if (wasDefault && buckets.length > 0) {
      buckets[0].isDefault = true;
    }
  };

  // 1. Add first bucket -> automatically default
  const b1 = addBucket({
    name: 'Primary R2',
    endpoint: 'https://r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'tako-backups',
    accessKeyId: 'key-1',
  });
  assert.equal(buckets.length, 1);
  assert.equal(b1.isDefault, true);

  // 2. Add second bucket -> not default
  const b2 = addBucket({
    name: 'MinIO Local',
    endpoint: 'http://minio:9000',
    region: 'us-east-1',
    bucket: 'snapshots',
    accessKeyId: 'minio-admin',
  });
  assert.equal(buckets.length, 2);
  assert.equal(b2.isDefault, false);
  assert.equal(buckets.find((b) => b.id === b1.id)?.isDefault, true);

  // 3. Update second bucket to default
  setDefaultBucket(b2.id);
  assert.equal(buckets.find((b) => b.id === b2.id)?.isDefault, true);
  assert.equal(buckets.find((b) => b.id === b1.id)?.isDefault, false);

  // 4. Update bucket fields
  const updatedB1 = updateBucket(b1.id, { name: 'Renamed R2 Storage' });
  assert.equal(updatedB1.name, 'Renamed R2 Storage');

  // 5. Delete active default bucket -> first remaining becomes default
  deleteBucket(b2.id);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].id, b1.id);
  assert.equal(buckets[0].isDefault, true);
});

test('S3 Error Parser - accurately identifies S3 error response conditions', () => {
  const parseS3Response = (status, body) => {
    if (status === 200) {
      return { ok: true, message: 'Connected successfully' };
    }
    if (status === 403) {
      if (body.includes('InvalidAccessKeyId')) {
        return { ok: false, message: 'Invalid Access Key ID' };
      }
      if (body.includes('SignatureDoesNotMatch')) {
        return { ok: false, message: 'Invalid Secret Access Key or signature mismatch' };
      }
      if (body.includes('AccessDenied')) {
        return { ok: false, message: 'Access Denied: Key lacks bucket permissions' };
      }
      return { ok: false, message: 'Authentication failed (HTTP 403)' };
    }
    if (status === 404) {
      return { ok: false, message: 'Bucket not found (HTTP 404)' };
    }
    return { ok: false, message: `HTTP ${status}` };
  };

  assert.equal(parseS3Response(200, '').ok, true);
  assert.equal(
    parseS3Response(403, '<Error><Code>SignatureDoesNotMatch</Code></Error>').message,
    'Invalid Secret Access Key or signature mismatch'
  );
  assert.equal(
    parseS3Response(403, '<Error><Code>InvalidAccessKeyId</Code></Error>').message,
    'Invalid Access Key ID'
  );
  assert.equal(
    parseS3Response(403, '<Error><Code>AccessDenied</Code></Error>').message,
    'Access Denied: Key lacks bucket permissions'
  );
  assert.equal(
    parseS3Response(404, '<Error><Code>NoSuchBucket</Code></Error>').message,
    'Bucket not found (HTTP 404)'
  );
});
