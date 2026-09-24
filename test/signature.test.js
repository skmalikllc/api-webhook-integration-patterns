import test from 'node:test';
import assert from 'node:assert/strict';
import { sign, verifyWebhook, safeEqual } from '../src/signature.js';

const secret = 'whsec_test';
const body = JSON.stringify({ id: 'evt_1', type: 'applicant.created' });
const nowMs = 1_700_000_000_000;
const ts = String(nowMs / 1000);

test('a genuine request verifies', () => {
  const r = verifyWebhook({ secret, timestamp: ts, rawBody: body, signature: sign(secret, ts, body), now: () => nowMs });
  assert.deepEqual(r, { ok: true });
});

test('a tampered body fails', () => {
  const sig = sign(secret, ts, body);
  const r = verifyWebhook({ secret, timestamp: ts, rawBody: body + ' ', signature: sig, now: () => nowMs });
  assert.equal(r.ok, false);
  assert.match(r.reason, /signature/);
});

test('the wrong secret fails', () => {
  const r = verifyWebhook({ secret, timestamp: ts, rawBody: body, signature: sign('other', ts, body), now: () => nowMs });
  assert.equal(r.ok, false);
});

test('a replayed old request is rejected', () => {
  const sig = sign(secret, ts, body);
  const r = verifyWebhook({ secret, timestamp: ts, rawBody: body, signature: sig, now: () => nowMs + 600_000 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /tolerance/);
});

test('a missing timestamp is rejected before anything else', () => {
  const r = verifyWebhook({ secret, timestamp: undefined, rawBody: body, signature: 'x' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /timestamp/);
});

test('comparison is length safe', () => {
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('abc', 'abc'), true);
});
