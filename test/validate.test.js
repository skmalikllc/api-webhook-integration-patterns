import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, get } from '../src/validate.js';

const rules = [
  { field: 'organization', required: true, type: 'string', min: 2 },
  { field: 'ein', required: true, type: 'string', pattern: /^\d{2}-?\d{7}$/ },
  { field: 'amount', type: 'number', min: 0 },
  { field: 'status', enum: ['new', 'review', 'approved'] },
  { field: 'contact.email', required: true, type: 'string', pattern: /.+@.+\..+/ },
];

test('get reads dotted paths and tolerates gaps', () => {
  assert.equal(get({ a: { b: { c: 1 } } }, 'a.b.c'), 1);
  assert.equal(get({ a: null }, 'a.b.c'), undefined);
});

test('a well formed payload passes', () => {
  const r = validate(
    { organization: 'Acme Foundation', ein: '12-3456789', amount: 500, status: 'new', contact: { email: 'a@b.co' } },
    rules,
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('every problem is reported, not just the first', () => {
  const r = validate({ organization: 'A', ein: 'nope', status: 'archived' }, rules);
  assert.equal(r.ok, false);
  const fields = r.errors.map((e) => e.field).sort();
  assert.deepEqual(fields, ['contact.email', 'ein', 'organization', 'status']);
});

test('an absent optional field is not an error', () => {
  const r = validate({ organization: 'Acme', ein: '123456789', contact: { email: 'a@b.co' } }, rules);
  assert.equal(r.ok, true);
});

test('empty string counts as missing for a required field', () => {
  const r = validate({ organization: '', ein: '123456789', contact: { email: 'a@b.co' } }, rules);
  assert.equal(r.errors[0].rule, 'required');
});

test('a wrong type is reported as a type error, not coerced', () => {
  const r = validate({ organization: 'Acme', ein: '123456789', amount: '500', contact: { email: 'a@b.co' } }, rules);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].field, 'amount');
  assert.equal(r.errors[0].rule, 'type');
});
