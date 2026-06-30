import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WelcomeNameForm } from './WelcomeNameForm';

export default async function WelcomeNamePage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const name = (user.user_metadata?.name as string | undefined) ?? null;
  const onboarded = user.user_metadata?.onboarded;
  const role = (user.user_metadata?.role as 'driver' | 'lender' | 'both' | undefined) ?? 'driver';

  // Already fully onboarded (name set, role explicitly chosen or a pre-existing account) —
  // never show the welcome flow, just forward to the right dashboard.
  if (name && onboarded !== false) {
    redirect(role === 'lender' ? '/lender/dashboard' : '/chargers');
  }

  return <WelcomeNameForm initialName={name ?? ''} />;
}
