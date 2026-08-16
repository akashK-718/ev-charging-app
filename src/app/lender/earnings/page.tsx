import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PLATFORM_COMMISSION_PERCENT } from '@/lib/constants';

// ── Payout status section ────────────────────────────────────────────────────
// Intentionally isolated: when RazorpayX payout wiring lands, replace the
// contents of this function with real payout data — nothing else changes.
function PayoutStatus({
  payoutReleasedAt,
  razorpayTransferId,
}: {
  payoutReleasedAt: string | null;
  razorpayTransferId: string | null;
}) {
  if (payoutReleasedAt && razorpayTransferId) {
    // Future state: real transfer data wired in here once RazorpayX lands.
    const date = new Date(payoutReleasedAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    return (
      <div className="pt-2 border-t border-gray-100 space-y-1">
        <p className="text-[10px] text-muted/70 uppercase tracking-wide font-semibold">Payout</p>
        <div className="flex justify-between text-xs">
          <span className="text-muted">Status</span>
          <span className="text-green font-semibold">Paid out</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted">Transfer date</span>
          <span className="text-ink">{date}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted">Reference</span>
          <span className="font-mono text-muted">{razorpayTransferId}</span>
        </div>
      </div>
    );
  }

  // Current honest state — RazorpayX payout wiring not yet complete.
  return (
    <div className="pt-2 border-t border-gray-100">
      <p className="text-xs text-muted">
        Payout processing — bank transfer integration in progress
      </p>
    </div>
  );
}

// ── Data fetching ────────────────────────────────────────────────────────────

type EnrichedSession = {
  id: string;
  confirmation_code: string;
  scheduled_start: string;
  scheduled_end: string;
  charger_title: string | null;
  payment: {
    gross_amount: number;
    platform_fee: number;
    lender_payout: number;
    payout_released_at: string | null;
    razorpay_transfer_id: string | null;
  } | null;
};

async function getEarningsData(userId: string) {
  const adminSupabase = createAdminClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // All completed bookings for this lender
  const { data: allBookings } = await adminSupabase
    .from('bookings')
    .select('id, confirmation_code, scheduled_start, scheduled_end, charger_id')
    .eq('lender_id', userId)
    .eq('status', 'completed')
    .order('scheduled_start', { ascending: false });

  const bookings = (allBookings ?? []) as Array<{
    id: string;
    confirmation_code: string;
    scheduled_start: string;
    scheduled_end: string;
    charger_id: string;
  }>;

  if (bookings.length === 0) {
    return { totalEarned: 0, thisMonth: 0, pendingPayout: 0, sessions: [] as EnrichedSession[] };
  }

  const bookingIds = bookings.map(b => b.id);
  const chargerIds = [...new Set(bookings.map(b => b.charger_id))];

  const [paymentsRes, chargersRes] = await Promise.all([
    adminSupabase
      .from('payments')
      .select('booking_id, gross_amount, platform_fee, lender_payout, payout_released_at, razorpay_transfer_id, created_at')
      .in('booking_id', bookingIds),
    adminSupabase
      .from('chargers')
      .select('id, title')
      .in('id', chargerIds),
  ]);

  const payments = (paymentsRes.data ?? []) as Array<{
    booking_id: string;
    gross_amount: number;
    platform_fee: number;
    lender_payout: number;
    payout_released_at: string | null;
    razorpay_transfer_id: string | null;
    created_at: string;
  }>;

  const chargerMap = new Map(
    ((chargersRes.data ?? []) as Array<{ id: string; title: string }>).map(c => [c.id, c.title]),
  );
  const paymentMap = new Map(payments.map(p => [p.booking_id, p]));

  // Summary totals
  const totalEarned = payments.reduce((sum, p) => sum + p.lender_payout, 0);
  const thisMonth = payments
    .filter(p => p.created_at >= startOfMonth)
    .reduce((sum, p) => sum + p.lender_payout, 0);
  const pendingPayout = payments
    .filter(p => !p.payout_released_at)
    .reduce((sum, p) => sum + p.lender_payout, 0);

  const sessions: EnrichedSession[] = bookings.map(b => ({
    id: b.id,
    confirmation_code: b.confirmation_code,
    scheduled_start: b.scheduled_start,
    scheduled_end: b.scheduled_end,
    charger_title: chargerMap.get(b.charger_id) ?? null,
    payment: paymentMap.get(b.id) ?? null,
  }));

  return { totalEarned, thisMonth, pendingPayout, sessions };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LenderEarningsPage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/auth');

  const { totalEarned, thisMonth, pendingPayout, sessions } = await getEarningsData(user.id);

  return (
    <main className="min-h-screen px-6 py-10 space-y-6 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] lg:pb-10">
      <h1 className="text-2xl font-medium text-ink">Earnings</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-muted uppercase tracking-wide font-semibold">Total earned</p>
          <p className="font-display font-extrabold text-3xl text-ink mt-1">
            ₹{(totalEarned / 100).toFixed(0)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-muted">This month</p>
            <p className="font-display font-bold text-xl text-ink mt-1">
              ₹{(thisMonth / 100).toFixed(0)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-muted">Pending payout</p>
            <p className="font-display font-bold text-xl text-ink mt-1">
              ₹{(pendingPayout / 100).toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      {/* Link to payouts */}
      <Link
        href="/lender/payouts"
        className="block px-4 py-3 bg-volt-soft rounded-xl border border-volt text-sm font-semibold text-ink hover:border-volt-deep transition-colors"
      >
        View detailed payout history →
      </Link>

      {/* Per-session earnings statements */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg text-ink">Completed sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">No completed sessions yet.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => (
              <div key={session.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">

                {/* Session header: charger + reference + date */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink text-sm">
                      {session.charger_title ?? 'Charger'}
                    </p>
                    <p className="text-xs text-muted font-mono mt-0.5">{session.confirmation_code}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(session.scheduled_start).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  {/* Download link — lender-only, distinct from driver's Payment Receipt */}
                  <a
                    href={`/api/lender/bookings/${session.id}/statement`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-volt-deep hover:text-volt-deep/80 transition-colors shrink-0 ml-3"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Statement
                  </a>
                </div>

                {/* Earnings breakdown */}
                {session.payment ? (
                  <>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted">Session total</span>
                        <span className="text-ink">₹{(session.payment.gross_amount / 100).toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Platform fee ({PLATFORM_COMMISSION_PERCENT}%)</span>
                        <span className="text-muted">−₹{(session.payment.platform_fee / 100).toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-100 pt-1.5">
                        <span className="font-semibold text-ink">Your earnings</span>
                        <span className="font-display font-bold text-green">
                          ₹{(session.payment.lender_payout / 100).toFixed(0)}
                        </span>
                      </div>
                    </div>

                    {/* Payout status — isolated for easy swap when RazorpayX lands */}
                    <PayoutStatus
                      payoutReleasedAt={session.payment.payout_released_at}
                      razorpayTransferId={session.payment.razorpay_transfer_id}
                    />
                  </>
                ) : (
                  <p className="text-xs text-muted">Payment data unavailable</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
