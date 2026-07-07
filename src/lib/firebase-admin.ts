import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Lazy singleton — initialised on first call so JSON.parse never runs at module
// load time (which would break Next.js static analysis in dev if the env var
// isn't set or has literal newlines in the private key).
export function getFcmAdmin() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) return null; // dev environment without FCM configured

  if (!getApps().length) {
    const serviceAccount = JSON.parse(json.trim());
    initializeApp({ credential: cert(serviceAccount) });
  }

  return getMessaging();
}
