import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({ hosting_setup_deferred: false })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: 'Could not update preference.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
