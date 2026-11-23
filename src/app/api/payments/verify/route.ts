import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { finalizeBookingPayment } from '@/lib/payments/booking-payment.server';

export async function POST(request: NextRequest) {
  const { data: { user }, error } = await createClient().auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = body ?? {};
  if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string' ||
      !/^order_[a-zA-Z0-9]+$/.test(orderId) || !/^pay_[a-zA-Z0-9]+$/.test(paymentId) ||
      !verifyPaymentSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  try {
    const result = await finalizeBookingPayment(orderId, paymentId, {
      id: user.id,
      name: user.user_metadata?.name,
    });
    switch (result.state) {
      case 'booked':
        return NextResponse.json({ data: { booking_id: result.bookingId } });
      case 'pending':
        return NextResponse.json({ error: 'Razorpay is still confirming the payment.' }, { status: 202 });
      case 'forbidden':
        return NextResponse.json({ error: 'Payment does not belong to this account.' }, { status: 403 });
      case 'conflict':
        return NextResponse.json({
          error: 'The slot was taken after checkout started. Contact support for a refund.',
          payment_id: paymentId,
        }, { status: 409 });
      default:
        return NextResponse.json({
          error: 'Razorpay could not confirm this booking payment.',
          payment_id: paymentId,
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[payments/verify] Could not confirm booking payment:', paymentId, error);
    return NextResponse.json({
      error: 'Could not confirm the payment. Check its status again before starting another payment.',
      payment_id: paymentId,
    }, { status: 502 });
  }
}
