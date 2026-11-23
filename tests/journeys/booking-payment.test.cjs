const test = require('node:test');
const assert = require('node:assert/strict');
const { NextResponse } = require('next/server');
const { loadHandler } = require('./support/load-handler.cjs');

function paymentFixture(overrides = {}) {
  const calls = [];
  let linkedBooking;
  const payment = {
    id: 'pay_test', order_id: 'order_test', currency: 'INR', amount: 4200,
    captured: true, status: 'captured', method: 'netbanking', ...overrides,
  };
  const order = {
    id: 'order_test', currency: 'INR', amount: 4200,
    notes: {
      kirin_booking: '1', charger_id: 'charger-test', driver_id: 'driver-test',
      lender_id: 'host-test', platform_fee: '630', constraint_type: 'duration',
      constraint_value: '30', scheduled_start: '2026-11-24T10:00:00.000Z',
      scheduled_end: '2026-11-24T10:30:00.000Z',
    },
  };
  let notified = false;
  const admin = {
    from(table) {
      const query = {
        eq() { return query; }, is() { return query; }, update() { return query; },
        select() {
          if (table !== 'bookings') return query;
          if (notified) return Promise.resolve({ data: [] });
          notified = true;
          return Promise.resolve({ data: [{ id: linkedBooking }] });
        },
        maybeSingle: async () => ({ data: linkedBooking ? { booking_id: linkedBooking } : null }),
        single: async () => ({ data: { title: 'Test Charger' } }),
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      linkedBooking = 'booking-test';
      return { data: linkedBooking };
    },
  };
  const notifications = [];
  const { finalizeBookingPayment } = loadHandler('src/lib/payments/booking-payment.server.ts', {
    '@/lib/supabase/server': { createAdminClient: () => admin },
    '@/lib/razorpay': { getRazorpay: () => ({
      orders: { fetch: async () => order }, payments: { fetch: async () => payment },
    }) },
    '@/lib/notifications/push': { sendPushNotification: async payload => notifications.push(payload) },
    '@/lib/utils': { generateConfirmationCode: () => 'TEST' },
  });
  return { finalizeBookingPayment, calls, notifications };
}

test('only the quoted driver can verify a payment and authorization alone creates no records', async () => {
  const fixture = paymentFixture({ status: 'authorized', captured: false });
  const { finalizeBookingPayment, calls, notifications } = fixture;
  assert.equal((await finalizeBookingPayment('order_test', 'pay_test', { id: 'other' })).state, 'forbidden');
  assert.equal((await finalizeBookingPayment('order_test', 'pay_test', { id: 'driver-test' })).state, 'pending');
  assert.deepEqual(calls, []);
  assert.deepEqual(notifications, []);
});

test('captured payments must match the booking order, amount, and currency and be unrefunded', async () => {
  for (const overrides of [
    { order_id: 'order_other' }, { amount: 4100 }, { currency: 'USD' },
    { amount_refunded: 100 }, { status: 'failed', captured: false },
  ]) {
    const { finalizeBookingPayment, calls } = paymentFixture(overrides);
    assert.equal((await finalizeBookingPayment('order_test', 'pay_test')).state, 'invalid');
    assert.deepEqual(calls, []);
  }
});

test('checkout and webhook retries share one booking, using the quote and actual payment method', async () => {
  const { finalizeBookingPayment, calls, notifications } = paymentFixture();
  const expected = { state: 'booked', bookingId: 'booking-test' };
  assert.deepEqual(await finalizeBookingPayment('order_test', 'pay_test'), expected);
  assert.deepEqual(await finalizeBookingPayment('order_test', 'pay_test', { id: 'driver-test' }), expected);
  assert.deepEqual(calls, [{ name: 'create_booking_with_payment', args: {
    p_charger_id: 'charger-test',
    p_driver_id: 'driver-test',
    p_lender_id: 'host-test',
    p_scheduled_start: '2026-11-24T10:00:00.000Z',
    p_scheduled_end: '2026-11-24T10:30:00.000Z',
    p_confirmation_code: 'TEST',
    p_gross_amount: 4200,
    p_platform_fee: 630,
    p_lender_payout: 3570,
    p_razorpay_order_id: 'order_test',
    p_razorpay_payment_id: 'pay_test',
    p_vehicle_id: null,
    p_payment_method: 'netbanking',
    p_card_network: null,
    p_card_last4: null,
    p_constraint_type: 'duration',
    p_constraint_value: 30,
  } }]);
  assert.equal(notifications.length, 1);
});

test('verification uses the checkout proof and authenticated identity, independently of client booking terms', async () => {
  const { POST } = loadHandler('src/app/api/payments/verify/route.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/server': {
      createClient: () => ({ auth: { getUser: async () => ({
        data: { user: { id: 'driver-test', user_metadata: { name: 'Driver' } } },
      }) } }),
    },
    '@/lib/razorpay': { verifyPaymentSignature: (order, payment, signature) => signature === 'valid-proof' },
    '@/lib/payments/booking-payment.server': { finalizeBookingPayment: async (...args) => {
      assert.deepEqual(args, ['order_test', 'pay_test', { id: 'driver-test', name: 'Driver' }]);
      return { state: 'booked', bookingId: 'booking-test' };
    } },
  });
  const response = await POST(new Request('http://localhost/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify({
      razorpay_order_id: 'order_test', razorpay_payment_id: 'pay_test', razorpay_signature: 'valid-proof',
      charger_id: 'other-charger', lender_payout: 0,
    }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { booking_id: 'booking-test' } });
});
