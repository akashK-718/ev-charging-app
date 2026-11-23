/**
 * Razorpay server SDK setup.
 *
 * Server-side use only. Never expose RAZORPAY_KEY_SECRET to the browser.
 * Used in API routes for creating orders, transferring to lenders, refunds, etc.
 */

import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Lazy-initialize so the module can be imported without crashing when env vars
// are absent (e.g. during `next build` without a .env.local).
let _razorpay: Razorpay | null = null;

export function getRazorpayKeyId(): string {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) throw new Error('NEXT_PUBLIC_RAZORPAY_KEY_ID must be set');
  if ((process.env.NODE_ENV === 'development' || process.env.OTP_BYPASS === 'true') &&
      !keyId.startsWith('rzp_test_')) {
    throw new Error('Razorpay test keys are required when running locally or using mock OTP');
  }
  return keyId;
}

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error('RAZORPAY_KEY_SECRET must be set');
    _razorpay = new Razorpay({ key_id: getRazorpayKeyId(), key_secret: keySecret });
  }
  return _razorpay;
}

/**
 * @deprecated use getRazorpay() instead
 * Kept for backward compat — will throw at call time if env vars are absent.
 */
export const razorpay: Razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    return (getRazorpay() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Verify a Razorpay webhook signature.
 * Always call this before trusting webhook data.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  return verifySignature(payload, signature, process.env.RAZORPAY_WEBHOOK_SECRET);
}

/**
 * Verify the signature Razorpay Checkout returns to the client after a
 * successful payment: hmac_sha256(order_id + "|" + payment_id, key_secret).
 * Always call this before trusting a client-reported payment as paid.
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  return verifySignature(`${orderId}|${paymentId}`, signature, process.env.RAZORPAY_KEY_SECRET);
}

function verifySignature(payload: string, signature: string, secret: string | undefined): boolean {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

/**
 * Refund a captured payment in full. Idempotent at the call site: callers
 * must check payments.razorpay_refund_id is still null before calling this,
 * and persist the returned refund id immediately after.
 */
export async function refundPayment(
  razorpayPaymentId: string,
  amountPaise: number,
): Promise<{ id: string }> {
  const refund = await getRazorpay().payments.refund(razorpayPaymentId, {
    amount: amountPaise,
    speed: 'normal',
  });
  return { id: refund.id };
}
