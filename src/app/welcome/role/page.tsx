import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WelcomeRoleForm } from './WelcomeRoleForm';

export default async function WelcomeRolePage({
  searchParams,
}: {
  searchParams: { intent?: string };
}) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const name = (user.user_metadata?.name as string | undefined) ?? null;
  if (!name) redirect('/welcome/name');

  const onboarded = user.user_metadata?.onboarded;
  const role = (user.user_metadata?.role as 'driver' | 'lender' | 'both' | undefined) ?? 'driver';

  // Already fully onboarded — never show the welcome flow, forward to the right dashboard.
  if (onboarded !== false) {
    redirect(role === 'lender' ? '/lender/dashboard' : '/explore');
  }

  return <WelcomeRoleForm intent={searchParams.intent} />;
}
