// End-to-end shape of an inbound webhook handler, using every module in src/.
// Run it with:  node examples/inbound-webhook.js
//
// There is no server here on purpose — the framework is the least interesting
// part. What matters is the order: verify, deduplicate, validate, map, act.

import { verifyWebhook, sign } from '../src/signature.js';
import { validate } from '../src/validate.js';
import { applyMapping } from '../src/map.js';
import { IdempotencyStore, once } from '../src/idempotency.js';
import { withRetry } from '../src/retry.js';
import { createLogger } from '../src/logger.js';

const log = createLogger();
const store = new IdempotencyStore();
const SECRET = 'whsec_example';

const MAPPING = [
  { from: 'data.Organization Name', to: 'organization', via: ['collapseSpace'] },
  { from: 'data.EIN', to: 'ein', via: ['digits'] },
  { from: 'data.Contact Email', to: 'contact.email', via: ['trim', 'lower'] },
  { from: 'data.Requested Amount', to: 'amount', via: ['toNumber'] },
  { to: 'source', const: 'intake-webhook' },
];

const RULES = [
  { field: 'organization', required: true, type: 'string', min: 2 },
  { field: 'ein', required: true, type: 'string', pattern: /^\d{9}$/ },
  { field: 'contact.email', required: true, type: 'string', pattern: /.+@.+\..+/ },
  { field: 'amount', type: 'number', min: 0 },
];

async function handle({ headers, rawBody }) {
  // 1. Is this really from the provider, and is it recent?
  const check = verifyWebhook({
    secret: SECRET,
    timestamp: headers['x-timestamp'],
    rawBody,
    signature: headers['x-signature'],
  });
  if (!check.ok) {
    log.warn('webhook.rejected', { reason: check.reason });
    return { status: 401 };
  }

  const event = JSON.parse(rawBody);

  // 2. Have we already done this? Providers retry; records should not double.
  return once(store, event.id, async () => {
    // 3. Is the payload the shape we were promised?
    const { result: record, unmapped } = applyMapping(event, MAPPING);
    if (unmapped.length) log.info('webhook.unmapped_fields', { fields: unmapped });

    const v = validate(record, RULES);
    if (!v.ok) {
      log.warn('webhook.invalid', { errors: v.errors });
      return { status: 422, errors: v.errors };
    }

    // 4. Do the work, and only retry what retrying can fix.
    await withRetry(async () => upsert(record), {
      onRetry: ({ attempt, delay }) => log.warn('upsert.retry', { attempt, delay }),
    });

    log.info('webhook.handled', { id: event.id, ein: record.ein });
    return { status: 200 };
  }).then((r) => r.result);
}

// Stand-in for whatever the destination system is.
async function upsert(record) {
  return { id: 'rec_' + record.ein };
}

// --- demo ---------------------------------------------------------------
const body = JSON.stringify({
  id: 'evt_0001',
  data: {
    'Organization Name': '  St.  Mary’s   Foundation ',
    EIN: '12-3456789',
    'Contact Email': ' Ops@Example.COM ',
    'Requested Amount': '2500',
    'Board Notes': 'not mapped anywhere yet',
  },
});
const ts = String(Math.floor(Date.now() / 1000));
const headers = { 'x-timestamp': ts, 'x-signature': sign(SECRET, ts, body) };

console.log(await handle({ headers, rawBody: body }));
console.log(await handle({ headers, rawBody: body })); // same event again
