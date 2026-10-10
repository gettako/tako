import test from 'node:test';
import assert from 'node:assert/strict';

test('API /api/auth returns 422 with field errors on missing fields', async () => {
  const res = await fetch('http://localhost:3000/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.errors?.email, 'Email is required');
  assert.equal(data.errors?.password, 'Password is required');
});

test('API /api/auth returns 422 with field errors on invalid email format', async () => {
  const res = await fetch('http://localhost:3000/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'invalid-email', password: 'my-password' }),
  });

  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.errors?.email, 'Please enter a valid email address');
  assert.equal(data.errors?.password, undefined);
});

test('API /api/auth returns 422 with password field error when password missing', async () => {
  const res = await fetch('http://localhost:3000/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gettako.dev', password: '' }),
  });

  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.errors?.email, undefined);
  assert.equal(data.errors?.password, 'Password is required');
});
