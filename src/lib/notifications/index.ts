type NotificationType =
  | 'booking_received'
  | 'booking_accepted'
  | 'booking_rejected'
  | 'booking_auto_rejected'
  | 'booking_no_show'
  | 'session_initiation_requested'
  | 'session_started'
  | 'session_completed'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'kyc_resubmission_required'
  | 'payout_processed';

export async function notify(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown> = {},
) {
  console.log(`[NOTIFICATION STUB] User ${userId}: ${type}`, data);
  // TODO: Module 6 — integrate FCM + MSG91
  // In-app: insert into notifications table
  try {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabase = createAdminClient();
    await supabase.from('notifications').insert({ user_id: userId, type, data });
  } catch {
    // non-fatal — notification delivery must never block business logic
  }
}
