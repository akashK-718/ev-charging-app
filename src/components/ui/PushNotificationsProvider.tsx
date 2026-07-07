'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';

/**
 * Mounts push notification permission request + FCM token registration on every
 * page load. Renders an inline toast for foreground messages (when the app is open).
 */
export function PushNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { toast } = usePushNotifications();

  return (
    <>
      {children}
      {toast && (
        <div className="fixed top-4 inset-x-4 z-[100] bg-ink text-white rounded-xl px-4 py-3 shadow-xl pointer-events-none">
          <p className="font-semibold text-sm">{toast.title}</p>
          {toast.body && <p className="text-xs text-white/70 mt-0.5">{toast.body}</p>}
        </div>
      )}
    </>
  );
}
