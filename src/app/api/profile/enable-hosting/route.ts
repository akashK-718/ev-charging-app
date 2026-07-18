import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const currentRole = (profile?.role ?? 'driver') as string;

  // Already hosting-enabled — idempotent
  if (currentRole === 'lender' || currentRole === 'both') {
    return NextResponse.json({ ok: true });
  }

  // Enable hosting: driver → lender
  const { error: updateError } = await admin
    .from('users')
    .update({ role: 'lender' })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Could not enable hosting. Please try again.' }, { status: 500 });
  }

  // Keep JWT metadata in sync so useAuth fast-path reflects the change
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { role: 'lender' },
  });

  return NextResponse.json({ ok: true });
}
