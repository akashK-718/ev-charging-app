importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Update behaviour — two paths:
//
// 1. App code / features (this file, Next.js chunks, API routes):
//    A new SW version downloads in the background once the browser detects a change
//    (checked on every navigation, or ~24h if the app stays open).
//    The new SW waits here in 'installed' state until the user taps "Update now"
//    in the UpdateBanner, which sends SKIP_WAITING → skipWaiting() fires → the
//    new SW activates → the page reloads to pick up the new JS bundles.
//    Without explicit user action NO reload ever happens automatically.
//
// 2. Installed app metadata (icon, name, splash — manifest.json):
//    These are cached by the OS at install time and do NOT update through the
//    service-worker lifecycle. Changing manifest.json updates the web experience
//    immediately, but the home-screen icon and splash on an already-installed PWA
//    only change after the user uninstalls and reinstalls the app. This is a
//    platform limitation, not a bug in the web app.

self.addEventListener('install', () => {
  // Do NOT call skipWaiting() here. Staying in 'waiting' lets UpdateBanner ask
  // the user before activating the new version, preventing a surprise reload
  // mid-booking, mid-payment, or mid-charging-session-confirmation.
});

self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Firebase is initialised lazily once the main page sends the config via postMessage.
// This avoids hardcoding public env vars in a static file while keeping the SW simple.
let messagingReady = false;

self.addEventListener('message', (event) => {
  // User tapped "Update now" in UpdateBanner — skip the waiting phase and take over.
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

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
      icon: '/brand/kirin-icon.svg',
      badge: '/brand/kirin-icon.svg',
      data: payload.data,
    });
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
