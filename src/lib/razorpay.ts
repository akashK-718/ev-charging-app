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

export const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

/**
 * Verify a Razorpay webhook signature.
 * Always call this before trusting webhook data.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
  return expected === signature;
}
