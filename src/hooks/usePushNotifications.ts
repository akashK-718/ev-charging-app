'use client';

import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '@/lib/firebase';

const TOAST_DURATION_MS = 4000;

export interface PushToast {
  title: string;
  body: string;
}

export function usePushNotifications() {
  const [toast, setToast] = useState<PushToast | null>(null);

  useEffect(() => {
    if (!messaging) return;

    // Request permission and register token
    void Notification.requestPermission().then(permission => {
      if (permission !== 'granted') return;
      getToken(messaging!, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY })
        .then(token => {
          if (!token) return;
          fetch('/api/users/fcm-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          }).catch(() => {});
        })
        .catch(() => {});
    });

    // Handle foreground messages — show inline toast instead of system notification
    const unsubscribe = onMessage(messaging!, payload => {
      const title = payload.notification?.title ?? '';
      const body = payload.notification?.body ?? '';
      if (!title) return;
      setToast({ title, body });
      setTimeout(() => setToast(null), TOAST_DURATION_MS);
    });

    return unsubscribe;
  }, []);

  return { toast };
}
