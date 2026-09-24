import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, isRetryable, backoffDelay } from '../src/retry.js';

const noSleep = async () => {};

test('classifies what is worth retrying', () => {
  assert.equal(isRetryable({ status: 429 }), true);
  assert.equal(isRetryable({ status: 503 }), true);
  assert.equal(isRetryable({ status: 400 }), false);
  assert.equal(isRetryable({ status: 401 }), false);
  assert.equal(isRetryable({ code: 'ETIMEDOUT' }), true);
  assert.equal(isRetryable(new Error('nope')), false);
});

test('backoff grows and is capped', () => {
  const random = () => 1; // worst case of full jitter
  assert.equal(backoffDelay(1, { baseMs: 250, random }), 250);
  assert.equal(backoffDelay(3, { baseMs: 250, random }), 1000);
  assert.equal(backoffDelay(20, { baseMs: 250, maxMs: 30000, random }), 30000);
});

test('succeeds on a later attempt', async () => {
  let calls = 0;
  const out = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw { status: 503 };
      return 'ok';
    },
    { sleep: noSleep },
  );
  assert.equal(out, 'ok');
  assert.equal(calls, 3);
});

test('a non-retryable error is thrown immediately, not retried', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw { status: 422 };
      },
      { sleep: noSleep },
    ),
  );
  assert.equal(calls, 1);
});

test('gives up after the configured number of attempts', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw { status: 500 };
      },
      { attempts: 3, sleep: noSleep },
    ),
  );
  assert.equal(calls, 3);
});

test('reports each retry so it is visible in a log', async () => {
  const seen = [];
  await withRetry(
    async (attempt) => {
      if (attempt < 2) throw { status: 500 };
      return 1;
    },
    { sleep: noSleep, onRetry: (i) => seen.push(i.attempt) },
  );
  assert.deepEqual(seen, [1]);
});
