import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const { data: charger } = await adminSupabase
    .from('chargers')
    .select('id, lender_id')
    .eq('id', params.id)
    .single();

  if (!charger) return NextResponse.json({ error: 'Charger not found' }, { status: 404 });
  if ((charger as { id: string; lender_id: string }).lender_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await adminSupabase
    .from('chargers')
    .update({ status: 'active' })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to unpause charger' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
