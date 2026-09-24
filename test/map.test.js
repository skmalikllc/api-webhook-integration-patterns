import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMapping, transforms } from '../src/map.js';

const mapping = [
  { from: 'Organization Name', to: 'organization', via: ['collapseSpace'] },
  { from: 'EIN', to: 'ein', via: ['digits'] },
  { from: 'Contact Email', to: 'contact.email', via: ['trim', 'lower'] },
  { from: 'Requested Amount', to: 'amount', via: ['toNumber'] },
  { from: 'Status', to: 'status', default: 'new' },
  { to: 'source', const: 'intake-form' },
];

test('maps, transforms and nests', () => {
  const { result } = applyMapping(
    {
      'Organization Name': '  St.  Mary’s   Foundation ',
      EIN: '12-3456789',
      'Contact Email': '  Ops@Example.COM ',
      'Requested Amount': '2500',
    },
    mapping,
  );
  assert.equal(result.organization, 'St. Mary’s Foundation');
  assert.equal(result.ein, '123456789');
  assert.equal(result.contact.email, 'ops@example.com');
  assert.equal(result.amount, 2500);
  assert.equal(result.status, 'new');
  assert.equal(result.source, 'intake-form');
});

test('the digits transform makes two spellings of one EIN comparable', () => {
  assert.equal(transforms.digits('12-3456789'), transforms.digits('123456789'));
});

test('fields the mapping never consumed are reported', () => {
  const { unmapped } = applyMapping({ EIN: '1', 'Board Notes': 'x', Attachment: 'y' }, mapping);
  assert.deepEqual(unmapped.sort(), ['Attachment', 'Board Notes']);
});

test('an unknown transform fails loudly at mapping time', () => {
  assert.throws(() => applyMapping({ a: 1 }, [{ from: 'a', to: 'b', via: ['nope'] }]), /unknown transform/);
});

test('absent optional source fields are simply not written', () => {
  const { result } = applyMapping({ EIN: '12' }, [{ from: 'Missing', to: 'x' }]);
  assert.equal('x' in result, false);
});
