import { createAdminClient } from '@/lib/supabase/server';
import { getFcmAdmin } from '@/lib/firebase-admin';

/**
 * Send a push notification to a single user via Firebase Admin SDK (FCM v1).
 * Fire-and-forget safe: never throws, silently skips if token is absent or
 * FCM is not configured (dev environment without FIREBASE_SERVICE_ACCOUNT_JSON).
 */
export async function sendPushNotification({
  userId,
  title,
  body,
  url,
}: {
  userId: string;
  title: string;
  body: string;
  url: string;
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

    // Data-only payload — no `notification` key anywhere so the Firebase SDK
    // does NOT auto-display a notification. The service worker's onBackgroundMessage
    // handler is the single display path, preventing the double-notification bug on Android.
    await messaging.send({
      token: userRow.fcm_token,
      data: { title, body, url },
      webpush: {
        headers: { Urgency: 'high' },
      },
    });
  } catch (err) {
    console.warn(`[push] Failed to send push notification to user ${userId}:`, err);
  }
}
