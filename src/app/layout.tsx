import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { PageTransition } from '@/components/ui/PageTransition';
import { PushNotificationsProvider } from '@/components/ui/PushNotificationsProvider';

export const metadata: Metadata = {
  title: 'Kirin',
  description: 'Find and book home EV chargers near you',
  manifest: '/manifest.json',
  icons: {
    icon: '/brand/kirin-icon.svg',
    apple: '/brand/kirin-icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kirin',
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
