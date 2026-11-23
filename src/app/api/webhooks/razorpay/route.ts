import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { finalizeBookingPayment } from '@/lib/payments/booking-payment.server';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-razorpay-signature');
  const rawBody = await request.text();
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = parseEvent(rawBody);
  if (!event) return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 });
  if (event.event !== 'payment.captured') return NextResponse.json({ received: true });

  const payment = event.payload?.payment?.entity;
  if (typeof payment?.order_id !== 'string' || typeof payment?.id !== 'string') {
    return NextResponse.json({ received: true });
  }

  try {
    const result = await finalizeBookingPayment(payment.order_id, payment.id);
    if (result.state === 'pending') {
      return NextResponse.json({ error: 'Payment capture is still processing' }, { status: 503 });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[razorpay webhook] Could not confirm booking payment:', payment.id, error);
    return NextResponse.json({ error: 'Could not confirm booking payment' }, { status: 503 });
  }
}

function parseEvent(rawBody: string): {
  event?: string;
  payload?: { payment?: { entity?: { order_id?: string; id?: string } } };
} | null {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}
