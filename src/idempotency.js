// Idempotency for handlers that may be delivered more than once.
//
// Every webhook provider worth using retries on a non-2xx, and some retry on a
// slow 2xx. If the handler creates a record, "delivered twice" means "invoiced
// twice" unless something remembers. This is the smallest thing that remembers:
// swap the Map for Redis or a table and the shape is unchanged.

export class IdempotencyStore {
  constructor({ ttlMs = 24 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.entries = new Map();
  }

  #sweep() {
    const t = this.now();
    for (const [k, v] of this.entries) if (v.expiresAt <= t) this.entries.delete(k);
  }

  /** @returns {{status:'new'}|{status:'duplicate', result:any}} */
  begin(key) {
    this.#sweep();
    const existing = this.entries.get(key);
    if (existing) return { status: 'duplicate', result: existing.result };
    this.entries.set(key, { result: undefined, expiresAt: this.now() + this.ttlMs });
    return { status: 'new' };
  }

  complete(key, result) {
    const e = this.entries.get(key);
    if (e) e.result = result;
    return result;
  }

  /** Failed work must not be remembered as done. */
  release(key) {
    this.entries.delete(key);
  }

  get size() {
    this.#sweep();
    return this.entries.size;
  }
}

/** Run `fn` at most once per key. */
export async function once(store, key, fn) {
  const state = store.begin(key);
  if (state.status === 'duplicate') return { duplicate: true, result: state.result };
  try {
    const result = await fn();
    store.complete(key, result);
    return { duplicate: false, result };
  } catch (err) {
    store.release(key);
    throw err;
  }
}
