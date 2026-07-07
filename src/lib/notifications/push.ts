import { createAdminClient } from '@/lib/supabase/server';

/**
 * Send a push notification to a single user via FCM legacy HTTP API.
 * Fire-and-forget safe: never throws, silently skips if token is absent.
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
    const supabase = createAdminClient();
    const { data: userRow } = await supabase
      .from('users')
      .select('fcm_token')
      .eq('id', userId)
      .single();

    if (!userRow?.fcm_token) return;

    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${process.env.FIREBASE_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: userRow.fcm_token,
        notification: { title, body },
        data: { url },
      }),
    });

    if (!res.ok) {
      console.warn(`[push] FCM send failed for user ${userId}: HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[push] Failed to send push notification to user ${userId}:`, err);
  }
}
