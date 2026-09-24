// Declarative field mapping between two payload shapes.
//
// Most integration failures are a mapping assumption, not a bug. Writing the
// mapping down as data — rather than burying it in code — means it can be
// reviewed by the person who actually knows what "Account Name" means in their
// CRM, and diffed when the upstream system changes.

import { get } from './validate.js';

function set(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = obj;
  for (const k of keys) {
    if (node[k] == null || typeof node[k] !== 'object') node[k] = {};
    node = node[k];
  }
  node[last] = value;
  return obj;
}

export const transforms = {
  trim: (v) => (typeof v === 'string' ? v.trim() : v),
  lower: (v) => (typeof v === 'string' ? v.toLowerCase() : v),
  upper: (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  // Digits only — the shape an EIN, a phone number or an account code should be
  // compared in, never the shape a human typed it in.
  digits: (v) => (typeof v === 'string' ? v.replace(/\D+/g, '') : v),
  collapseSpace: (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v),
  toNumber: (v) => (v === '' || v == null ? v : Number(v)),
  toBoolean: (v) => (typeof v === 'boolean' ? v : ['true', 'yes', '1', 1].includes(v)),
};

/**
 * @param {object} source
 * @param {Array<{from?:string, to:string, const?:any, default?:any, via?:string[]}>} mapping
 * @returns {{result:object, unmapped:string[]}}
 */
export function applyMapping(source, mapping) {
  const result = {};
  const used = new Set();

  for (const m of mapping) {
    let value;
    if ('const' in m) {
      value = m.const;
    } else {
      value = get(source, m.from);
      used.add(m.from.split('.')[0]);
      for (const t of m.via || []) {
        const fn = transforms[t];
        if (!fn) throw new Error(`unknown transform "${t}" for ${m.from} -> ${m.to}`);
        value = fn(value);
      }
      if ((value === undefined || value === '') && 'default' in m) value = m.default;
    }
    if (value !== undefined) set(result, m.to, value);
  }

  // Anything the source sent that no rule consumed. Silence here is how a field
  // that started mattering six months ago goes unnoticed for another six.
  const unmapped = Object.keys(source).filter((k) => !used.has(k));
  return { result, unmapped };
}
