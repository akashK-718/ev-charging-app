import { redirect } from 'next/navigation';

// Superseded by the two-step welcome flow — name collection now lives at /welcome/name.
// Kept as a redirect for backward compatibility with any existing links.
export default function ProfileNameRedirectPage() {
  redirect('/welcome/name');
}
