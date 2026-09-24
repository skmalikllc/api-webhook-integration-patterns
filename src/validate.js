// Input validation for an inbound payload.
//
// The rule this encodes: never trust that this month's payload has the same
// shape as last month's. Validate at the boundary, collect EVERY problem, and
// return them together — a caller that fixes one field at a time across five
// round trips is a caller that gives up.

const TYPES = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  boolean: (v) => typeof v === 'boolean',
  array: (v) => Array.isArray(v),
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
};

export function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * @param {object} payload
 * @param {Array<{field:string,type?:string,required?:boolean,enum?:any[],pattern?:RegExp,min?:number,max?:number}>} rules
 * @returns {{ok:boolean, errors:Array<{field:string,rule:string,message:string}>}}
 */
export function validate(payload, rules) {
  const errors = [];
  const fail = (field, rule, message) => errors.push({ field, rule, message });

  for (const r of rules) {
    const value = get(payload, r.field);
    const missing = value === undefined || value === null || value === '';

    if (r.required && missing) {
      fail(r.field, 'required', `${r.field} is required`);
      continue;
    }
    if (missing) continue; // optional and absent: nothing else to check

    if (r.type) {
      const check = TYPES[r.type];
      if (!check) fail(r.field, 'type', `unknown type "${r.type}" in rule`);
      else if (!check(value)) fail(r.field, 'type', `${r.field} must be a ${r.type}`);
    }
    if (r.enum && !r.enum.includes(value)) {
      fail(r.field, 'enum', `${r.field} must be one of: ${r.enum.join(', ')}`);
    }
    if (r.pattern && typeof value === 'string' && !r.pattern.test(value)) {
      fail(r.field, 'pattern', `${r.field} is not in the expected format`);
    }
    if (typeof r.min === 'number') {
      const n = typeof value === 'string' || Array.isArray(value) ? value.length : value;
      if (n < r.min) fail(r.field, 'min', `${r.field} must be at least ${r.min}`);
    }
    if (typeof r.max === 'number') {
      const n = typeof value === 'string' || Array.isArray(value) ? value.length : value;
      if (n > r.max) fail(r.field, 'max', `${r.field} must be at most ${r.max}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
