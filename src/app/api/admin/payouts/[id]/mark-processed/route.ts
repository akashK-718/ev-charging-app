import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';

async function getAdminUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return null;
  return user;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

  const { data: payout, error: fetchError } = await adminSupabase
    .from('payouts')
    .select('id, user_id, status, booking_ids, amount_paise')
    .eq('id', params.id)
    .single();

  if (fetchError || !payout) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
  }

  const p = payout as {
    id: string; user_id: string; status: string;
    booking_ids: string[]; amount_paise: number;
  };

  if (p.status !== 'pending') {
    return NextResponse.json({ error: `Payout is already ${p.status}` }, { status: 409 });
  }

  const now = new Date().toISOString();

  // Update payout status
  const { error: updatePayoutError } = await adminSupabase
    .from('payouts')
    .update({ status: 'completed', processed_at: now })
    .eq('id', params.id);

  if (updatePayoutError) {
    return NextResponse.json({ error: 'Failed to mark payout as processed' }, { status: 500 });
  }

  // Release payments — set payout_released_at for all bookings in this payout
  if (p.booking_ids.length > 0) {
    await adminSupabase
      .from('payments')
      .update({ payout_released_at: now, status: 'transferred' })
      .in('booking_id', p.booking_ids);
  }

  await notify(p.user_id, 'payout_processed', {
    payout_id: params.id,
    amount_paise: p.amount_paise,
    booking_count: p.booking_ids.length,
  });

  return NextResponse.json({ ok: true });
}
