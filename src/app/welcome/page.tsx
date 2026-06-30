import { redirect } from 'next/navigation';

// Welcome flow is now two steps: /welcome/name → /welcome/role.
// Kept as a redirect for backward compatibility with any existing links.
export default function WelcomePage() {
  redirect('/welcome/name');
}
