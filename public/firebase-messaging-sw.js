importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDmsORa3GhyX2VRvpDaUcgOrzygxJx9ETw',
  authDomain: 'ev-charging-app-fa053.firebaseapp.com',
  projectId: 'ev-charging-app-fa053',
  storageBucket: 'ev-charging-app-fa053.firebasestorage.app',
  messagingSenderId: '1061508570716',
  appId: '1:1061508570716:web:12d916a4f93928ee785099',
});

const messaging = firebase.messaging();

// Handles data-only FCM messages (no `notification` key in the FCM payload).
// Messages that include a webpush.notification object (e.g. action-button
// notifications) are displayed directly by the browser and skip this handler.
messaging.onBackgroundMessage(payload => {
  const title = payload.data?.title ?? 'Kirin';
  const body = payload.data?.body ?? '';
  const url = payload.data?.url ?? '/';

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url },
  });
});

self.addEventListener('notificationclick', event => {
  const action = event.action;
  const notifData = event.notification.data ?? {};
  const url = notifData.url ?? '/';
  const bookingId = notifData.booking_id;

  event.notification.close();

  if (action === 'keep_waiting' && bookingId) {
    event.waitUntil(
      fetch(`/api/bookings/${bookingId}/no-show-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'keep_waiting' }),
      })
        .then(() =>
          self.registration.showNotification('Waiting extended', {
            body: 'Booking kept active for 30 more minutes.',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            tag: `noshow-extended-${bookingId}`,
          })
        )
        .catch(() => clients.openWindow(url))
    );
    return;
  }

  if (action === 'mark_no_show' && bookingId) {
    event.waitUntil(
      fetch(`/api/bookings/${bookingId}/no-show-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark_no_show' }),
      })
        .then(() =>
          self.registration.showNotification('Booking closed', {
            body: 'No-show recorded. Booking has been closed.',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            tag: `noshow-confirmed-${bookingId}`,
          })
        )
        .catch(() => clients.openWindow(url))
    );
    return;
  }

  // Default: open the booking URL
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
