import type { Metadata, Viewport } from 'next';
import { Manrope, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { PageTransition } from '@/components/ui/PageTransition';
import { PushNotificationsProvider } from '@/components/ui/PushNotificationsProvider';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EV Charging Marketplace',
  description: 'Find and book home EV chargers near you',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EV Charging',
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
    <html lang="en" className={`${manrope.variable} ${bricolage.variable}`}>
      <body>
        <Navbar />
        <PushNotificationsProvider>
          <PageTransition>
            {children}
          </PageTransition>
        </PushNotificationsProvider>
        <script dangerouslySetInnerHTML={{ __html: `
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
