// Retry with exponential backoff and full jitter.
//
// Two rules worth stating out loud:
//  1. Only retry what can succeed on a retry. A 400 will be a 400 forever;
//     retrying it just turns one bad request into five.
//  2. Jitter is not decoration. Without it, every failed job in a batch retries
//     at the same instant and re-creates the outage it is recovering from.

export const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryable(err) {
  if (err && typeof err.status === 'number') return RETRYABLE_STATUS.has(err.status);
  if (err && typeof err.code === 'string') {
    return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'EPIPE'].includes(err.code);
  }
  return false;
}

export function backoffDelay(attempt, { baseMs = 250, maxMs = 30000, random = Math.random } = {}) {
  const ceiling = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
  return Math.round(random() * ceiling); // full jitter
}

/**
 * @param {() => Promise<any>} fn
 * @param {{attempts?:number, baseMs?:number, maxMs?:number, sleep?:Function, random?:Function,
 *          retryable?:(e:any)=>boolean, onRetry?:Function}} opts
 */
export async function withRetry(fn, opts = {}) {
  const {
    attempts = 4,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    retryable = isRetryable,
    onRetry = () => {},
  } = opts;

  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !retryable(err)) throw err;
      const delay = backoffDelay(attempt, opts);
      onRetry({ attempt, delay, error: err });
      await sleep(delay);
    }
  }
  throw lastErr;
}
