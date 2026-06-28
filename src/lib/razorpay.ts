/**
 * Razorpay server SDK setup.
 *
 * Server-side use only. Never expose RAZORPAY_KEY_SECRET to the browser.
 * Used in API routes for creating orders, transferring to lenders, refunds, etc.
 */

import Razorpay from 'razorpay';

if (!process.env.RAZORPAY_KEY_SECRET) {
  console.warn(
    '[razorpay] RAZORPAY_KEY_SECRET is not set. Payment endpoints will fail.'
  );
}

// Lazy-initialize so the module can be imported without crashing when env vars
// are absent (e.g. during `next build` without a .env.local).
let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay env vars NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
    }
    _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
  return expected === signature;
}
