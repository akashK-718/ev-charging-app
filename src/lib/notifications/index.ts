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

// Persists an in-app notification record only — does NOT send FCM.
// FCM is handled exclusively by the direct sendPushNotification() calls
// in each route, which carry rich context (names, charger titles, etc.).
export async function notify(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown> = {},
) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabase = createAdminClient();
    await supabase.from('notifications').insert({ user_id: userId, type, data });
  } catch {
    // non-fatal — notification history must never block business logic
  }
}
