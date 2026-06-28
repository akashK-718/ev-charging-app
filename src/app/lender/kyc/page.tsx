import { permanentRedirect } from 'next/navigation';

// KYC flow moved to /profile/verify
export default function LenderKycPage() {
  permanentRedirect('/profile/verify');
}
