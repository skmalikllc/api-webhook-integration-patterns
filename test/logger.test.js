import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, createLogger } from '../src/logger.js';

test('secrets are redacted at any depth', () => {
  const out = redact({
    url: 'https://api.example.com/v1/records',
    headers: { Authorization: 'Bearer abc123', 'Content-Type': 'application/json' },
    body: { user: { email: 'a@b.co', api_key: 'sk_live_xyz' } },
  });
  assert.equal(out.headers.Authorization, '[redacted]');
  assert.equal(out.headers['Content-Type'], 'application/json');
  assert.equal(out.body.user.api_key, '[redacted]');
  assert.equal(out.body.user.email, 'a@b.co');
});

test('arrays are walked too', () => {
  const out = redact([{ token: 't' }, { keep: 1 }]);
  assert.equal(out[0].token, '[redacted]');
  assert.equal(out[1].keep, 1);
});

test('circular structures do not hang the logger', () => {
  const a = { name: 'a' };
  a.self = a;
  assert.equal(redact(a).self, '[circular]');
});

test('the logger emits one structured line', () => {
  const lines = [];
  const log = createLogger({ sink: (l) => lines.push(l), now: () => '2026-01-01T00:00:00.000Z' });
  log.info('request.sent', { status: 200, token: 'nope' });
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.level, 'info');
  assert.equal(parsed.event, 'request.sent');
  assert.equal(parsed.status, 200);
  assert.equal(parsed.token, '[redacted]');
});
