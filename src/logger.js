// Structured logging that does not leak the thing you are integrating with.
//
// An integration log is the first place a token ends up, and the last place
// anyone looks for one. Redaction belongs in the logger, not in the discipline
// of whoever writes the next log line.

const DEFAULT_SECRET_KEYS = [
  'authorization', 'auth', 'password', 'passwd', 'secret', 'token',
  'access_token', 'refresh_token', 'api_key', 'apikey', 'client_secret',
  'signature', 'cookie', 'set-cookie', 'private_key',
];

export function redact(value, secretKeys = DEFAULT_SECRET_KEYS, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((v) => redact(v, secretKeys, seen));

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = secretKeys.includes(k.toLowerCase()) ? '[redacted]' : redact(v, secretKeys, seen);
  }
  return out;
}

export function createLogger({ sink = console.log, secretKeys, now = () => new Date().toISOString() } = {}) {
  const emit = (level) => (event, fields = {}) =>
    sink(JSON.stringify({ ts: now(), level, event, ...redact(fields, secretKeys) }));
  return { info: emit('info'), warn: emit('warn'), error: emit('error') };
}
