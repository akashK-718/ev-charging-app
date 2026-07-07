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

messaging.onBackgroundMessage(payload => {
  const title = payload.data?.title ?? 'EV Charging';
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
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
