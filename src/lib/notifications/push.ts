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

    await messaging.send({
      token: userRow.fcm_token,
      notification: {
        title,
        body,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: '/icons/icon-192x192.png',
        },
        fcmOptions: {
          link: url,
        },
      },
    });
  } catch (err) {
    console.warn(`[push] Failed to send push notification to user ${userId}:`, err);
  }
}
