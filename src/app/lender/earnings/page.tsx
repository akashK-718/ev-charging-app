import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getEarningsData(userId: string) {
  const adminSupabase = createAdminClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [allPaymentsRes, monthPaymentsRes, pendingPaymentsRes, bookingsRes] = await Promise.all([
    // All-time completed payments
    adminSupabase
      .from('payments')
      .select('lender_payout, gross_amount, platform_fee, booking_id, created_at, payout_released_at')
      .eq('status', 'paid')
      .in(
        'booking_id',
        (await adminSupabase.from('bookings').select('id').eq('lender_id', userId)).data?.map(b => b.id) ?? [],
      ),
    // This month's payments
    adminSupabase
      .from('payments')
      .select('lender_payout, booking_id')
      .eq('status', 'paid')
      .gte('created_at', startOfMonth)
      .in(
        'booking_id',
        (await adminSupabase.from('bookings').select('id').eq('lender_id', userId)).data?.map(b => b.id) ?? [],
      ),
    // Pending (unreleased)
    adminSupabase
      .from('payments')
      .select('lender_payout, booking_id')
      .eq('status', 'paid')
      .is('payout_released_at', null)
      .in(
        'booking_id',
        (await adminSupabase.from('bookings').select('id').eq('lender_id', userId)).data?.map(b => b.id) ?? [],
      ),
    // Recent completed bookings with charger titles
    adminSupabase
      .from('bookings')
      .select('id, scheduled_start, charger_id, status')
      .eq('lender_id', userId)
      .eq('status', 'completed')
      .order('scheduled_start', { ascending: false })
      .limit(20),
  ]);

  const allPayments = (allPaymentsRes.data ?? []) as Array<{
    lender_payout: number; gross_amount: number; platform_fee: number;
    booking_id: string; created_at: string; payout_released_at: string | null;
  }>;

  const totalEarned = allPayments.reduce((sum, p) => sum + p.lender_payout, 0);
  const thisMonth = ((monthPaymentsRes.data ?? []) as Array<{ lender_payout: number }>)
    .reduce((sum, p) => sum + p.lender_payout, 0);
  const pendingPayout = ((pendingPaymentsRes.data ?? []) as Array<{ lender_payout: number }>)
    .reduce((sum, p) => sum + p.lender_payout, 0);

  // Enrich recent bookings with charger titles and payment info
  const recentBookings = (bookingsRes.data ?? []) as Array<{
    id: string; scheduled_start: string; charger_id: string; status: string;
  }>;

  const chargerIds = [...new Set(recentBookings.map(b => b.charger_id))];
  const { data: chargersData } = chargerIds.length > 0
    ? await adminSupabase.from('chargers').select('id, title').in('id', chargerIds)
    : { data: [] };

  const chargerMap = new Map(
    ((chargersData ?? []) as Array<{ id: string; title: string }>).map(c => [c.id, c]),
  );
  const paymentMap = new Map(allPayments.map(p => [p.booking_id, p]));

  const enrichedBookings = recentBookings.map(b => ({
    ...b,
    charger_title: chargerMap.get(b.charger_id)?.title ?? null,
    payment: paymentMap.get(b.id) ?? null,
  }));

  return { totalEarned, thisMonth, pendingPayout, enrichedBookings };
}

export default async function LenderEarningsPage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const { totalEarned, thisMonth, pendingPayout, enrichedBookings } = await getEarningsData(user.id);

  return (
    <main className="min-h-screen px-6 py-10 space-y-6">
      <h1 className="font-display font-extrabold text-3xl text-ink">Earnings</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-muted uppercase tracking-wide font-semibold">Total earned</p>
          <p className="font-display font-extrabold text-3xl text-ink mt-1">
            ₹{(totalEarned / 100).toFixed(0)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-muted">This month</p>
            <p className="font-display font-bold text-xl text-ink mt-1">
              ₹{(thisMonth / 100).toFixed(0)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
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
        className="block px-4 py-3 bg-volt-soft rounded-2xl border border-volt text-sm font-semibold text-ink hover:border-volt-deep transition-colors"
      >
        View detailed payout history →
      </Link>

      {/* Completed bookings table */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg text-ink">Completed sessions</h2>
        {enrichedBookings.length === 0 ? (
          <p className="text-sm text-muted">No completed sessions yet.</p>
        ) : (
          <div className="space-y-2">
            {enrichedBookings.map(booking => (
              <div key={booking.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink text-sm">
                      {booking.charger_title ?? 'Charger'}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(booking.scheduled_start).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  {booking.payment ? (
                    <div className="text-right">
                      <p className="font-display font-bold text-ink">
                        ₹{(booking.payment.lender_payout / 100).toFixed(0)}
                      </p>
                      <p className="text-xs text-muted">
                        {booking.payment.payout_released_at ? 'paid out' : 'pending'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">—</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
