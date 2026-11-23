import test from 'node:test';
import assert from 'node:assert/strict';
import { transformToken } from '../src/lib/payments/tokens';

test('card display uses the masked billing label instead of the token identifier', () => {
  const method = transformToken({ id: 'token_card', method: 'card', billing_label: 'Visa (4242)',
    card: { network: 'Visa', token_iin: '999999', expiry_month: 3, expiry_year: 2028, issuer: 'Bank' } });
  assert.deepEqual(method, { id: 'token_card', method: 'card', billingLabel: 'Visa (4242)',
    cardNetwork: 'Visa', cardLast4: '4242', cardExpiry: '03/28', cardIssuer: 'Bank' });
});

test('card tokens tolerate missing optional card metadata', () => {
  const method = transformToken({ id: 'token_card', method: 'card' });
  assert.equal(method?.cardLast4, undefined);
  assert.equal(method?.cardExpiry, undefined);
  assert.equal(method?.method, 'card');
  assert.equal(transformToken({ id: 'token_card', method: 'card', card: { token_iin: '123456' } })?.cardLast4, '3456');
});

test('UPI tokens preserve the VPA and unsupported methods are excluded', () => {
  assert.deepEqual(transformToken({ id: 'token_upi', method: 'upi', upi: { vpa: 'demo@bank' } }),
    { id: 'token_upi', method: 'upi', upiVpa: 'demo@bank', billingLabel: undefined });
  assert.equal(transformToken({ id: 'token_wallet', method: 'wallet' }), null);
});
