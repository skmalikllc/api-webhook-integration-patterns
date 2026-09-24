// Verifying that an inbound webhook came from who it claims to.
//
// This is the standard HMAC scheme most providers use. Two details that are
// easy to get wrong and expensive to get wrong:
//  - compare in constant time, not with ===
//  - reject old timestamps, or a captured request can be replayed forever

import { createHmac, timingSafeEqual } from 'node:crypto';

export function sign(secret, timestamp, rawBody) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * @returns {{ok:true}|{ok:false, reason:string}}
 */
export function verifyWebhook({ secret, timestamp, rawBody, signature, toleranceSec = 300, now = () => Date.now() }) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'missing or malformed timestamp' };

  const ageSec = Math.abs(now() / 1000 - ts);
  if (ageSec > toleranceSec) return { ok: false, reason: 'timestamp outside tolerance window' };

  if (!safeEqual(sign(secret, timestamp, rawBody), signature)) {
    return { ok: false, reason: 'signature mismatch' };
  }
  return { ok: true };
}
