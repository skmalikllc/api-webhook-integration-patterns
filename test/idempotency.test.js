import test from 'node:test';
import assert from 'node:assert/strict';
import { IdempotencyStore, once } from '../src/idempotency.js';

test('the same delivery id only does the work once', async () => {
  const store = new IdempotencyStore();
  let runs = 0;
  const work = async () => { runs++; return 'created'; };

  const a = await once(store, 'evt_1', work);
  const b = await once(store, 'evt_1', work);

  assert.equal(runs, 1);
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(b.result, 'created');
});

test('different delivery ids are independent', async () => {
  const store = new IdempotencyStore();
  let runs = 0;
  await once(store, 'a', async () => runs++);
  await once(store, 'b', async () => runs++);
  assert.equal(runs, 2);
});

test('failed work is not remembered as done', async () => {
  const store = new IdempotencyStore();
  let runs = 0;
  await assert.rejects(once(store, 'evt_2', async () => { runs++; throw new Error('boom'); }));
  await once(store, 'evt_2', async () => { runs++; return 'ok'; });
  assert.equal(runs, 2);
});

test('entries expire', () => {
  let t = 0;
  const store = new IdempotencyStore({ ttlMs: 1000, now: () => t });
  store.begin('k');
  assert.equal(store.size, 1);
  t = 1001;
  assert.equal(store.size, 0);
});
