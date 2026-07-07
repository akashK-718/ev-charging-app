'use client';

import { useEffect, useState } from 'react';
import { getFirebaseMessaging } from '@/lib/firebase';

const TOAST_DURATION_MS = 4000;

export interface PushToast {
  title: string;
  body: string;
}

export function usePushNotifications() {
  const [toast, setToast] = useState<PushToast | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging) return;

      // Request permission and register token
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const { getToken, onMessage } = await import('firebase/messaging');

      getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY })
        .then(token => {
          if (!token) return;
          fetch('/api/users/fcm-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          }).catch(() => {});
        })
        .catch(() => {});

      // Handle foreground messages — show inline toast instead of system notification.
      // Read from payload.data (not payload.notification) to match the data-only send format.
      unsubscribe = onMessage(messaging, payload => {
        const title = payload.data?.title ?? '';
        const body = payload.data?.body ?? '';
        if (!title) return;
        setToast({ title, body });
        setTimeout(() => setToast(null), TOAST_DURATION_MS);
      });
    })();

    return () => { unsubscribe?.(); };
  }, []);

  return { toast };
}
