import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Guard: must have at least one published charger to pause
  const { count } = await admin
    .from('chargers')
    .select('id', { count: 'exact', head: true })
    .eq('lender_id', user.id)
    .in('status', ['active', 'paused'])
    .is('deleted_at', null);

  if (!count || count === 0) {
    return NextResponse.json({ error: 'No published chargers to pause.' }, { status: 400 });
  }

  const { error } = await admin
    .from('users')
    .update({ hosting_paused: true })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Could not pause hosting. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
