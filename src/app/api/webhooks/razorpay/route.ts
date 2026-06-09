import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/razorpay';

/**
 * Razorpay webhook handler.
 *
 * CRITICAL: always verify signature before trusting any data here.
 * Razorpay sends webhooks for: payment.captured, payment.failed,
 * order.paid, transfer.processed, refund.processed, etc.
 *
 * TODO (Milestone 5):
 *   - handle payment.captured → mark payment paid
 *   - handle transfer.processed → mark payout transferred
 *   - handle refund.processed → mark refund complete
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-razorpay-signature');
  const rawBody = await request.text();

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  switch (event.event) {
    case 'payment.captured':
      // TODO: mark payment paid, send notification
      break;
    case 'transfer.processed':
      // TODO: mark payout complete
      break;
    case 'refund.processed':
      // TODO: mark refund complete
      break;
  }

  return NextResponse.json({ received: true });
}
