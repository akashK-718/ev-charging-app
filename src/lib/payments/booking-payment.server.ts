import { createAdminClient } from '@/lib/supabase/server';
import { getRazorpay } from '@/lib/razorpay';
import { sendPushNotification } from '@/lib/notifications/push';
import { generateConfirmationCode } from '@/lib/utils';

type BookingPaymentResult =
  | { state: 'booked'; bookingId: string }
  | { state: 'unrelated' | 'forbidden' | 'pending' | 'invalid' | 'conflict' };

export async function finalizeBookingPayment(
  orderId: string,
  paymentId: string,
  driver?: { id: string; name?: string },
): Promise<BookingPaymentResult> {
  const razorpay = getRazorpay();
  const order = await razorpay.orders.fetch(orderId);
  const notes = order.notes;
  if (notes?.kirin_booking !== '1') return { state: 'unrelated' };

  const { charger_id, lender_id, driver_id, scheduled_start, scheduled_end } = notes;
  if (driver && driver_id !== driver.id) return { state: 'forbidden' };

  const grossAmount = Number(order.amount);
  const platformFee = Number(notes.platform_fee);
  if (
    typeof charger_id !== 'string' || typeof lender_id !== 'string' ||
    typeof driver_id !== 'string' || typeof scheduled_start !== 'string' ||
    typeof scheduled_end !== 'string' ||
    order.id !== orderId || order.currency !== 'INR' ||
    !Number.isSafeInteger(grossAmount) || grossAmount < 100 ||
    !Number.isSafeInteger(platformFee) || platformFee < 0 || platformFee > grossAmount
  ) return { state: 'invalid' };

  const admin = createAdminClient();
  const findBooking = async () => {
    const { data, error } = await admin.from('payments').select('booking_id')
      .eq('razorpay_payment_id', paymentId).eq('razorpay_order_id', orderId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.booking_id;
  };
  let bookingId = await findBooking();

  if (!bookingId) {
    const payment = await razorpay.payments.fetch(paymentId);
    if (
      payment.id !== paymentId || payment.order_id !== orderId ||
      payment.currency !== 'INR' || Number(payment.amount) !== grossAmount
    ) return { state: 'invalid' };
    if (payment.status === 'authorized') return { state: 'pending' };
    if (payment.status !== 'captured' || !payment.captured || payment.amount_refunded) {
      return { state: 'invalid' };
    }

    const { data, error } = await admin.rpc('create_booking_with_payment', {
      p_charger_id: charger_id,
      p_driver_id: driver_id,
      p_lender_id: lender_id,
      p_scheduled_start: scheduled_start,
      p_scheduled_end: scheduled_end,
      p_confirmation_code: generateConfirmationCode(),
      p_gross_amount: grossAmount,
      p_platform_fee: platformFee,
      p_lender_payout: grossAmount - platformFee,
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: paymentId,
      p_vehicle_id: typeof notes.vehicle_id === 'string' ? notes.vehicle_id : null,
      p_payment_method: payment.method ?? null,
      p_card_network: payment.method === 'card' ? payment.card?.network ?? null : null,
      p_card_last4: payment.method === 'card' ? payment.card?.last4 ?? null : null,
      p_constraint_type: typeof notes.constraint_type === 'string' ? notes.constraint_type : null,
      p_constraint_value: notes.constraint_value == null ? null : Number(notes.constraint_value),
    });
    // A parallel webhook or browser callback may have committed while this
    // request was waiting on the charger's row lock.
    bookingId = data ?? await findBooking();
    if (!bookingId) {
      if (error?.message.includes('SLOT_CONFLICT')) {
        console.error('[booking payment] Captured payment requires a refund due to a slot conflict:', paymentId);
        return { state: 'conflict' };
      }
      throw new Error(error?.message ?? 'Booking creation failed');
    }
  }

  const { data: claimed } = await admin.from('bookings')
    .update({ notification_sent_at: new Date().toISOString() })
    .eq('id', bookingId).is('notification_sent_at', null).select('id');

  if (claimed?.length) {
    const { data: charger } = await admin.from('chargers').select('title').eq('id', charger_id).single();
    await sendPushNotification({
      userId: lender_id,
      title: 'New booking request',
      body: `${driver?.name ?? 'A driver'} wants to charge at ${charger?.title ?? 'your charger'}`,
      url: `/lender/bookings/${bookingId}`,
      category: 'hosting_activity',
    }).catch(() => console.error('[booking payment] Could not notify host for booking:', bookingId));
  }

  return { state: 'booked', bookingId };
}
