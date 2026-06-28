import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PAYOUT_HOLD_HOURS } from '@/lib/constants';

/**
 * GET /api/lender/payouts
 *
 * Query: ?tab=pending|processed|all (default: all)
 *
 * pending  — completed bookings with paid payments, payout_released_at IS NULL,
 *            and session ended > PAYOUT_HOLD_HOURS ago (hold period satisfied),
 *            not already included in a completed payout.
 * processed — payouts rows where user_id = current user, status = 'completed'
 * all       — combine both
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['lender', 'both'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only lenders can view payouts' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') ?? 'all';

  const holdCutoff = new Date(Date.now() - PAYOUT_HOLD_HOURS * 60 * 60 * 1000).toISOString();

  // ── Pending items: completed bookings with paid-but-unreleased payments ──────
  const pendingItems: Array<{
    booking_id: string;
    scheduled_start: string;
    scheduled_end: string;
    charger_title: string | null;
    gross_amount: number;
    platform_fee: number;
    lender_payout: number;
  }> = [];

  let pendingTotal = 0;

  if (tab === 'pending' || tab === 'all') {
    const { data: payments } = await adminSupabase
      .from('payments')
      .select('booking_id, gross_amount, platform_fee, lender_payout')
      .eq('status', 'paid')
      .is('payout_released_at', null)
      .in(
        'booking_id',
        // subselect: completed bookings belonging to this lender where actual_end < hold cutoff
        (
          await adminSupabase
            .from('bookings')
            .select('id')
            .eq('lender_id', user.id)
            .eq('status', 'completed')
            .lt('actual_end', holdCutoff)
        ).data?.map(b => b.id) ?? [],
      );

    const rawPayments = (payments ?? []) as Array<{
      booking_id: string;
      gross_amount: number;
      platform_fee: number;
      lender_payout: number;
    }>;

    // Fetch charger titles via bookings
    const bookingIds = rawPayments.map(p => p.booking_id);
    const bookingRows = bookingIds.length > 0
      ? await adminSupabase
          .from('bookings')
          .select('id, scheduled_start, scheduled_end, charger_id')
          .in('id', bookingIds)
      : { data: [] };

    const chargerIds = [...new Set((bookingRows.data ?? []).map((b: { charger_id: string }) => b.charger_id))];
    const chargerRows = chargerIds.length > 0
      ? await adminSupabase.from('chargers').select('id, title').in('id', chargerIds)
      : { data: [] };

    const bookingMap = new Map(
      ((bookingRows.data ?? []) as Array<{ id: string; scheduled_start: string; scheduled_end: string; charger_id: string }>)
        .map(b => [b.id, b]),
    );
    const chargerMap = new Map(
      ((chargerRows.data ?? []) as Array<{ id: string; title: string }>)
        .map(c => [c.id, c]),
    );

    for (const p of rawPayments) {
      const booking = bookingMap.get(p.booking_id);
      const charger = booking ? chargerMap.get(booking.charger_id) : null;
      pendingItems.push({
        booking_id: p.booking_id,
        scheduled_start: booking?.scheduled_start ?? '',
        scheduled_end: booking?.scheduled_end ?? '',
        charger_title: charger?.title ?? null,
        gross_amount: p.gross_amount,
        platform_fee: p.platform_fee,
        lender_payout: p.lender_payout,
      });
      pendingTotal += p.lender_payout;
    }
  }

  // ── Processed payouts ────────────────────────────────────────────────────────
  const processedPayouts: Array<{
    id: string;
    amount_paise: number;
    status: string;
    bank_or_upi: string;
    booking_ids: string[];
    created_at: string;
    processed_at: string | null;
  }> = [];

  if (tab === 'processed' || tab === 'all') {
    const { data: payouts } = await adminSupabase
      .from('payouts')
      .select('id, amount_paise, status, bank_or_upi, booking_ids, created_at, processed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('processed_at', { ascending: false });

    processedPayouts.push(
      ...((payouts ?? []) as typeof processedPayouts),
    );
  }

  return NextResponse.json({
    pending: {
      items: pendingItems,
      total_paise: pendingTotal,
      count: pendingItems.length,
    },
    processed: processedPayouts,
    tab,
  });
}
