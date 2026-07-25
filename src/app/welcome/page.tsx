import { redirect } from 'next/navigation';

// Kept as a redirect for backward compatibility with any existing links.
export default function WelcomePage() {
  redirect('/welcome/name');
}
