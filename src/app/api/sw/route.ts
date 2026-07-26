// Root cause fix: public/sw.js was a static file whose bytes never changed
// between app-code deployments. The browser's SW update check is a byte-comparison —
// if the bytes are identical, `updatefound` never fires and the UpdateBanner never
// shows, even after a real deployment. This route handler injects VERCEL_DEPLOYMENT_ID
// (unique per Vercel deployment) as a top-line comment, guaranteeing a byte change on
// every deploy without altering any SW behaviour.
//
// Local dev fallback: Date.now() at module load time changes on each dev-server restart
// (which happens on every file save), so the update path is fully testable locally.

export const dynamic = 'force-dynamic';

const BUILD_ID =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  String(Date.now());

const SW_BODY = `\
// Build: ${BUILD_ID}

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Update behaviour — two paths:
//
// 1. App code / features (this file, Next.js chunks, API routes):
//    A new SW version downloads in the background once the browser detects a change
//    (checked on every navigation, or ~24h if the app stays open).
//    The new SW waits here in 'installed' state until the user taps "Update now"
//    in the UpdateBanner, which sends SKIP_WAITING -> skipWaiting() fires ->
//    the new SW activates -> the page reloads to pick up new JS bundles.
//    Without explicit user action NO reload ever happens automatically.
//
// 2. Installed app metadata (icon, name, splash -- manifest.json):
//    These are cached by the OS at install time and do NOT update through the
//    service-worker lifecycle. Changing manifest.json updates the web experience
//    immediately, but the home-screen icon and splash on an already-installed PWA
//    only change after the user uninstalls and reinstalls. Platform limitation.

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
`;

export function GET() {
  return new Response(SW_BODY, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Browsers must always re-fetch the SW script to detect updates.
      // 'no-cache' allows conditional requests (304s) but prevents stale serving.
      'Cache-Control': 'no-cache',
      // Explicitly grants scope '/' even though the rewrite makes the browser
      // see the script at /sw.js (which already defaults to scope /). Belt-and-suspenders.
      'Service-Worker-Allowed': '/',
    },
  });
}
