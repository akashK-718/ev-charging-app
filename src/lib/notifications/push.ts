import { createAdminClient } from '@/lib/supabase/server';
import { getFcmAdmin } from '@/lib/firebase-admin';

export type NotificationCategory =
  | 'booking_updates'
  | 'charging_reminders'
  | 'hosting_activity'
  | 'kyc_updates'
  | 'payments_payouts'
  | 'security_alerts'
  | 'product_announcements'
  | 'promotions_offers';

/**
 * Send a push notification to a single user via Firebase Admin SDK (FCM v1).
 * Fire-and-forget safe: never throws, silently skips if token is absent or
 * FCM is not configured (dev environment without FIREBASE_SERVICE_ACCOUNT_JSON).
 *
 * `category` maps to a column in `notification_preferences`. The push is
 * suppressed if the user has opted that category out. `security_alerts` is
 * always sent regardless of stored preferences. If no preferences row exists
 * the per-column DB defaults apply (all on except `promotions_offers`).
 *
 * When `actions` is provided, the FCM message includes a webpush.notification
 * object so the browser renders interactive action buttons. Without actions,
 * only the FCM data payload is sent and the service worker's onBackgroundMessage
 * handler shows the notification — this prevents the double-display bug.
 */
export async function sendPushNotification({
  userId,
  title,
  body,
  url,
  category,
  actions,
  requireInteraction,
  tag,
  notificationData,
}: {
  userId: string;
  title: string;
  body: string;
  url: string;
  category: NotificationCategory;
  actions?: Array<{ action: string; title: string }>;
  requireInteraction?: boolean;
  tag?: string;
  notificationData?: Record<string, string>;
}): Promise<void> {
  try {
    const messaging = getFcmAdmin();
    if (!messaging) return;

    const supabase = createAdminClient();

    const { data: userRow } = await supabase
      .from('users')
      .select('fcm_token')
      .eq('id', userId)
      .single();

    if (!userRow?.fcm_token) return;

    // Security alerts are never suppressible.
    if (category !== 'security_alerts') {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select(category)
        .eq('user_id', userId)
        .maybeSingle();

      if (prefs !== null) {
        // Row exists — honour the stored preference.
        if ((prefs as Record<string, boolean>)[category] === false) return;
      } else {
        // No row yet: apply coded defaults. Only promotions_offers defaults off.
        if (category === 'promotions_offers') return;
      }
    }

    await messaging.send({
      token: userRow.fcm_token as string,
      // Data-only payload is always included for service-worker access.
      data: { title, body, url },
      webpush: {
        headers: { Urgency: 'high' },
        // When actions are requested, include the notification object so the
        // browser renders action buttons. This bypasses onBackgroundMessage
        // (which only fires for data-only messages) and prevents double-display.
        ...(actions ? {
          notification: {
            title,
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            actions,
            requireInteraction: requireInteraction ?? false,
            ...(tag ? { tag } : {}),
            data: { url, ...notificationData },
          },
        } : {}),
      },
    });
  } catch (err) {
    console.warn(`[push] Failed to send push notification to user ${userId}:`, err);
  }
}
