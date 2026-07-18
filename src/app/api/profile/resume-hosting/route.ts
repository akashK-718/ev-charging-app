import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from('users')
    .update({ hosting_paused: false })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Could not resume hosting. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
