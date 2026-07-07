importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Firebase is initialised lazily once the main page sends the config via postMessage.
// This avoids hardcoding public env vars in a static file while keeping the SW simple.
let messagingReady = false;

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'FIREBASE_CONFIG' || messagingReady) return;
  messagingReady = true;

  const config = event.data.config;
  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'New notification';
    const body = payload.notification?.body ?? '';
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.data,
    });
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
