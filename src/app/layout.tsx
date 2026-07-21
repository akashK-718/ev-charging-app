import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { PageTransition } from '@/components/ui/PageTransition';
import { PushNotificationsProvider } from '@/components/ui/PushNotificationsProvider';
import { SplashIntro } from '@/components/ui/SplashIntro';

export const metadata: Metadata = {
  title: 'Kirin',
  description: 'Find and book home EV chargers near you',
  manifest: '/manifest.json',
  icons: {
    icon: '/brand/kirin-icon-square.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kirin',
    startupImage: [
      // ── Light mode ──────────────────────────────────────────────────────────
      { url: '/splash/light/splash-750x1334.png',
        media: '(device-width:375px) and (device-height:667px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait) and (prefers-color-scheme:light)' },
      { url: '/splash/light/splash-828x1792.png',
        media: '(device-width:414px) and (device-height:896px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait) and (prefers-color-scheme:light)' },
      { url: '/splash/light/splash-1125x2436.png',
        media: '(device-width:375px) and (device-height:812px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:light)' },
      { url: '/splash/light/splash-1170x2532.png',
        media: '(device-width:390px) and (device-height:844px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:light)' },
      { url: '/splash/light/splash-1179x2556.png',
        media: '(device-width:393px) and (device-height:852px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:light)' },
      { url: '/splash/light/splash-1284x2778.png',
        media: '(device-width:428px) and (device-height:926px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:light)' },
      { url: '/splash/light/splash-1290x2796.png',
        media: '(device-width:430px) and (device-height:932px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:light)' },
      // ── Dark mode ───────────────────────────────────────────────────────────
      { url: '/splash/dark/splash-750x1334.png',
        media: '(device-width:375px) and (device-height:667px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait) and (prefers-color-scheme:dark)' },
      { url: '/splash/dark/splash-828x1792.png',
        media: '(device-width:414px) and (device-height:896px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait) and (prefers-color-scheme:dark)' },
      { url: '/splash/dark/splash-1125x2436.png',
        media: '(device-width:375px) and (device-height:812px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:dark)' },
      { url: '/splash/dark/splash-1170x2532.png',
        media: '(device-width:390px) and (device-height:844px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:dark)' },
      { url: '/splash/dark/splash-1179x2556.png',
        media: '(device-width:393px) and (device-height:852px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:dark)' },
      { url: '/splash/dark/splash-1284x2778.png',
        media: '(device-width:428px) and (device-height:926px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:dark)' },
      { url: '/splash/dark/splash-1290x2796.png',
        media: '(device-width:430px) and (device-height:932px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:dark)' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SplashIntro />
        <Navbar />
        <BottomNav />
        <PushNotificationsProvider>
          <PageTransition>
            {children}
          </PageTransition>
        </PushNotificationsProvider>
        {/* Capture beforeinstallprompt before React hydration so it's never missed */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__pwaPrompt = e;
          });
          window.addEventListener('appinstalled', function() {
            window.__pwaPrompt = null;
          });
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').then(reg => {
                var firebaseConfig = ${JSON.stringify({
                  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
                  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
                })};
                var sw = reg.installing || reg.waiting || reg.active;
                if (sw) sw.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
              });
            });
          }
        `}} />
      </body>
    </html>
  );
}
