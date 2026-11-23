import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { PAYOUT_HOLD_HOURS } from '@/lib/constants';
import { formatINR } from '@/lib/currency';
import { sendPushNotification } from '@/lib/notifications/push';
import { getAdminUser } from '@/lib/admin';
import { readKillSwitch } from '@/lib/app-settings';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payoutsEnabled = await readKillSwitch('allow_payouts');
  if (!payoutsEnabled) {
    return NextResponse.json({ error: 'Payout processing is temporarily unavailable.' }, { status: 503 });
  }

  const adminSupabase = createAdminClient();

  const { data: payout, error: fetchError } = await adminSupabase
    .from('payouts')
    .select('id, user_id, amount_paise')
    .eq('id', params.id)
    .single();

  if (fetchError || !payout) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
  }

  const { error } = await adminSupabase.rpc('record_processed_payout', {
    p_id: payout.id, p_admin: adminUser.id, p_hold_hours: PAYOUT_HOLD_HOURS,
  });
  if (error) {
    const failures: Record<string, [number, string]> = {
      PAYOUT_FORBIDDEN: [403, 'Forbidden'],
      PAYOUT_NOT_FOUND: [404, 'Payout not found'],
      PAYOUT_ALREADY_REVIEWED: [409, 'This payout is no longer pending.'],
      PAYOUT_ON_HOLD: [409, `Payouts can be processed ${PAYOUT_HOLD_HOURS} hours after session completion.`],
      PAYOUT_RECONCILIATION_FAILED: [409, 'Check the linked bookings, payments and payout amount.'],
    };
    const [status, message] = failures[error.message] ?? [500, 'Could not record this payout.'];
    return NextResponse.json({ error: message }, { status });
  }

  await sendPushNotification({
    userId: payout.user_id,
    title: 'Payout processed',
    body: `Your host payout of ${formatINR(payout.amount_paise)} was marked processed.`,
    url: '/lender/payouts',
    category: 'payments_payouts',
  });
  return NextResponse.json({ ok: true });
}
