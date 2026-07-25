import { redirect } from 'next/navigation';

// Role selection was removed — onboarding ends at name capture.
// See docs/INFORMATION_ARCHITECTURE.md § Authentication Flow.
export default function WelcomeRolePage() {
  redirect('/home');
}
