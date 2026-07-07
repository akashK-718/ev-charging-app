import { sendPushNotification } from '@/lib/notifications/push';

type NotificationType =
  | 'booking_received'
  | 'booking_accepted'
  | 'booking_rejected'
  | 'booking_auto_rejected'
  | 'booking_cancelled'
  | 'booking_no_show'
  | 'session_initiation_requested'
  | 'session_started'
  | 'session_end_requested'
  | 'session_completed'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'kyc_resubmission_required'
  | 'payout_processed';

function notificationMeta(
  type: NotificationType,
  data: Record<string, unknown>,
): { title: string; body: string; url: string } {
  const bookingId = data.booking_id as string | undefined;
  const driverUrl = bookingId ? `/bookings/${bookingId}` : '/bookings';
  const lenderUrl = bookingId ? `/lender/bookings/${bookingId}` : '/lender/bookings';

  switch (type) {
    case 'booking_received':
      return { title: 'New Booking Request', body: 'A driver has requested your charger', url: lenderUrl };
    case 'booking_accepted':
      return { title: 'Booking Confirmed', body: 'Your booking has been accepted', url: driverUrl };
    case 'booking_rejected':
      return { title: 'Booking Declined', body: 'Your booking request was declined', url: driverUrl };
    case 'booking_auto_rejected':
      return { title: 'Booking Expired', body: "Your request wasn't confirmed in time", url: driverUrl };
    case 'booking_cancelled':
      return { title: 'Booking Cancelled', body: 'A booking has been cancelled', url: lenderUrl };
    case 'booking_no_show':
      return { title: 'Driver No-Show', body: 'The driver did not arrive for the session', url: lenderUrl };
    case 'session_initiation_requested':
      return { title: 'Session Starting', body: 'Tap to confirm and start charging', url: driverUrl };
    case 'session_started':
      return { title: 'Session Started', body: 'The charging session has begun', url: lenderUrl };
    case 'session_end_requested':
      return { title: 'Session Ending', body: 'Tap to confirm and end the session', url: driverUrl };
    case 'session_completed':
      return { title: 'Session Complete', body: 'Your charging session has ended', url: driverUrl };
    case 'kyc_approved':
      return { title: 'KYC Approved', body: 'Your identity verification has been approved', url: '/lender/kyc' };
    case 'kyc_rejected':
      return { title: 'KYC Rejected', body: 'Your identity verification was not approved', url: '/lender/kyc' };
    case 'kyc_resubmission_required':
      return { title: 'KYC Update Required', body: 'Please resubmit your verification documents', url: '/lender/kyc' };
    case 'payout_processed':
      return { title: 'Payout Processed', body: 'Your earnings have been transferred', url: '/lender/earnings' };
  }
}

export async function notify(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown> = {},
) {
  const { title, body, url } = notificationMeta(type, data);

  // Persist in-app notification and send push in parallel — neither blocks business logic
  await Promise.all([
    (async () => {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        await supabase.from('notifications').insert({ user_id: userId, type, data });
      } catch {
        // non-fatal
      }
    })(),
    sendPushNotification({ userId, title, body, url }),
  ]);
}
