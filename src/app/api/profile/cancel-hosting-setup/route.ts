import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Resets the account fully to Not Enabled state.
// Called from the verification screen ("Cancel verification") and from
// the charger draft wizard ("Delete draft") — both onboarding surfaces.
// Does not affect accounts that have already published a charger.
export async function POST() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();

  // Guard: refuse if a published charger already exists (user is past onboarding)
  const { count } = await admin
    .from('chargers')
    .select('id', { count: 'exact', head: true })
    .eq('lender_id', user.id)
    .in('status', ['active', 'paused'])
    .is('deleted_at', null);

  if (count && count > 0) {
    return NextResponse.json({ error: 'Cannot cancel setup after publishing a charger.' }, { status: 409 });
  }

  // Soft-delete any draft chargers
  await admin
    .from('chargers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('lender_id', user.id)
    .eq('status', 'draft')
    .is('deleted_at', null);

  // Remove pending KYC submissions (they haven't been reviewed yet)
  await admin
    .from('kyc_submissions')
    .delete()
    .eq('user_id', user.id)
    .eq('status', 'pending');

  // Reset the user row to Not Enabled state
  const { error: updateError } = await admin
    .from('users')
    .update({
      role: 'driver',
      kyc_status: 'not_started',
      hosting_paused: false,
      hosting_setup_deferred: false,
    })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Could not cancel setup. Please try again.' }, { status: 500 });
  }

  // Keep JWT metadata in sync
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { role: 'driver' },
  });

  return NextResponse.json({ ok: true });
}
