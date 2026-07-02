import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { BookOpen, Clock, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchParams {
  listed?: string;
  kyc?: string;
}

type ChargerRow = {
  id: string;
  title: string;
  address: string;
  status: string;
  total_sessions: number;
};

async function getLenderData(userId: string) {
  const adminSupabase = createAdminClient();

  // Week starts Monday 00:00 local-ish (UTC here — acceptable for earnings display)
  const now = new Date();
  const daysToMonday = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const [userResult, chargersResult, weekBookingsResult, recentResult] = await Promise.all([
    adminSupabase
      .from('users')
      .select('id, name, kyc_status')
      .eq('id', userId)
      .single(),

    adminSupabase
      .from('chargers')
      .select('id, title, address, status, total_sessions')
      .eq('lender_id', userId)
      .is('deleted_at', null)
      .in('status', ['draft', 'active', 'paused']),

    // Completed bookings this week — IDs only, for earnings sum
    adminSupabase
      .from('bookings')
      .select('id')
      .eq('lender_id', userId)
      .eq('status', 'completed')
      .gte('ended_at', weekStart.toISOString()),

    adminSupabase
      .from('bookings')
      .select('id, status, scheduled_start')
      .eq('lender_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // Sum lender_payout for this week's completed bookings
  const weekBookingIds = (weekBookingsResult.data ?? []).map(
    (b: { id: string }) => b.id
  );
  let weekEarningsPaise = 0;
  if (weekBookingIds.length > 0) {
    const { data: weekPayments } = await adminSupabase
      .from('payments')
      .select('lender_payout')
      .in('booking_id', weekBookingIds);
    weekEarningsPaise = (weekPayments ?? []).reduce(
      (sum: number, p: { lender_payout: number }) => sum + (p.lender_payout ?? 0),
      0
    );
  }

  return {
    user: userResult.data as { id: string; name: string | null; kyc_status: string } | null,
    chargers: (chargersResult.data ?? []) as ChargerRow[],
    weekEarningsPaise,
    recentBookings: (recentResult.data ?? []) as Array<{
      id: string;
      status: string;
      scheduled_start: string;
    }>,
  };
}

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  confirmed: 'bg-volt-soft text-volt-deep',
  in_progress: 'bg-blue-50 text-blue-700',
  completed: 'bg-gray-100 text-muted',
  cancelled: 'bg-red-50 text-red-700',
  rejected: 'bg-red-50 text-red-700',
  auto_rejected: 'bg-red-50 text-red-700',
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  auto_rejected: 'Expired',
};

const CHARGER_STATUS_SORT: Record<string, number> = {
  draft: 0,
  active: 1,
  paused: 2,
  suspended: 3,
};

function ChargerStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
      status === 'active' ? 'bg-volt-soft text-volt-deep' :
      status === 'draft'  ? 'bg-yellow-50 text-yellow-700' :
      status === 'paused' ? 'bg-gray-100 text-muted' :
                            'bg-red-50 text-red-600',
    )}>
      {status === 'active' ? 'Live' :
       status === 'draft'  ? 'Draft' :
       status === 'paused' ? 'Paused' : 'Suspended'}
    </span>
  );
}

function chargerSubtitle(charger: ChargerRow): string {
  if (charger.status === 'active') return `${charger.total_sessions} booking${charger.total_sessions !== 1 ? 's' : ''}`;
  if (charger.status === 'draft')  return 'Awaiting verification';
  if (charger.status === 'paused') return 'Not visible to drivers';
  return '';
}

export default async function LenderDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const { user: profile, chargers, weekEarningsPaise, recentBookings } = await getLenderData(user.id);
  if (!profile) redirect('/login');

  const kycStatus = (profile.kyc_status ?? 'not_started') as string;
  const liveChargers  = chargers.filter(c => c.status === 'active').length;
  const draftChargers = chargers.filter(c => c.status === 'draft').length;
  const weekEarningsRupees = Math.floor(weekEarningsPaise / 100);

  const sortedChargers = [...chargers].sort(
    (a, b) => (CHARGER_STATUS_SORT[a.status] ?? 99) - (CHARGER_STATUS_SORT[b.status] ?? 99)
  );
  const displayedChargers = sortedChargers.slice(0, 3);
  const hasMoreChargers = sortedChargers.length > 3;

  return (
    <main className="min-h-screen px-6 py-10 space-y-6">
      {/* Action banners */}
      {searchParams.listed === '1' && (
        <div className="px-4 py-3 bg-volt-soft rounded-2xl border border-volt">
          <p className="font-semibold text-ink">
            {kycStatus === 'approved'
              ? "Charger listed! It's now live for drivers."
              : 'Charger saved as draft. Complete verification in Profile to publish it.'}
          </p>
        </div>
      )}
      {searchParams.kyc === 'submitted' && (
        <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-200">
          <p className="font-semibold text-blue-800">KYC submitted! We&apos;ll review within 24–48 hours.</p>
        </div>
      )}

      {/* KYC status banners */}
      {kycStatus === 'not_started' && draftChargers > 0 && (
        <div className="px-4 py-3 bg-yellow-50 rounded-2xl border border-yellow-200 flex items-center justify-between gap-3">
          <p className="text-sm text-yellow-800">
            Your {draftChargers} charger{draftChargers > 1 ? 's are' : ' is'} ready.{' '}
            <Link href="/profile" className="font-semibold underline underline-offset-2">
              Complete verification in Profile
            </Link>{' '}
            to start earning.
          </p>
        </div>
      )}
      {kycStatus === 'pending' && (
        <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-200">
          <p className="text-sm text-blue-800 font-semibold">Verification under review</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Usually 24–48 hours.
            {draftChargers > 0 && ` Your ${draftChargers} draft charger${draftChargers > 1 ? 's' : ''} will publish automatically once approved.`}
          </p>
        </div>
      )}
      {kycStatus === 'rejected' && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl border border-red-200">
          <p className="text-sm text-red-800">
            Verification rejected — update your details in{' '}
            <Link href="/profile" className="font-semibold underline underline-offset-2">Profile</Link>{' '}
            to resubmit.
          </p>
        </div>
      )}

      {/* Heading */}
      <h1 className="font-display font-extrabold text-3xl text-ink">
        {profile.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Welcome back'}
      </h1>

      {/* Tappable stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/lender/earnings"
          className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:bg-gray-50 hover:border-gray-200 transition-colors cursor-pointer relative"
        >
          <ChevronRight className="absolute top-2 right-2 w-3.5 h-3.5 text-gray-300" />
          <p className="text-2xl font-display font-extrabold text-ink">₹{weekEarningsRupees}</p>
          <p className="text-xs text-muted mt-1">This week</p>
        </Link>
        <Link
          href="/lender/chargers?filter=active"
          className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:bg-gray-50 hover:border-gray-200 transition-colors cursor-pointer relative"
        >
          <ChevronRight className="absolute top-2 right-2 w-3.5 h-3.5 text-gray-300" />
          <p className="text-2xl font-display font-extrabold text-ink">{liveChargers}</p>
          <p className="text-xs text-muted mt-1">Live</p>
        </Link>
        <Link
          href="/lender/chargers?filter=draft"
          className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:bg-gray-50 hover:border-gray-200 transition-colors cursor-pointer relative"
        >
          <ChevronRight className="absolute top-2 right-2 w-3.5 h-3.5 text-gray-300" />
          <p className="text-2xl font-display font-extrabold text-ink">{draftChargers}</p>
          <p className="text-xs text-muted mt-1">Drafts</p>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="space-y-2">
        <h2 className="font-semibold text-lg text-ink">Quick actions</h2>
        <div className="grid grid-cols-1 gap-2">
          <Link
            href="/lender/bookings"
            className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-gray-200 transition-colors"
          >
            <BookOpen className="w-5 h-5 text-volt-deep" />
            <span className="font-semibold text-ink text-sm">View bookings</span>
          </Link>
          <Link
            href="/lender/earnings"
            className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-gray-200 transition-colors"
          >
            <Clock className="w-5 h-5 text-volt-deep" />
            <span className="font-semibold text-ink text-sm">View earnings</span>
          </Link>
        </div>
      </div>

      {/* My chargers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg text-ink">My chargers</h2>
          <Link
            href="/lender/chargers/new"
            className="flex items-center gap-1 text-xs font-semibold text-volt-deep"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </Link>
        </div>

        {chargers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-sm text-muted mb-3">You haven&apos;t added any chargers yet.</p>
            <Link
              href="/lender/chargers/new"
              className="inline-block px-4 py-2 bg-ink text-white text-sm font-bold rounded-xl hover:bg-ink/90 transition-colors"
            >
              Add your first charger
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedChargers.map(charger => (
              <Link
                key={charger.id}
                href={`/lender/chargers/${charger.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-3 hover:border-gray-200 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-ink truncate">{charger.title}</p>
                    <ChargerStatusBadge status={charger.status} />
                  </div>
                  <p className="text-xs text-muted">{chargerSubtitle(charger)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </Link>
            ))}
            {hasMoreChargers && (
              <Link
                href="/lender/chargers"
                className="block text-center text-sm font-semibold text-volt-deep py-2"
              >
                View all chargers
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Recent bookings */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg text-ink">Recent bookings</h2>
        {recentBookings.length === 0 ? (
          <p className="text-sm text-muted">No bookings yet.</p>
        ) : (
          <div className="space-y-2">
            {recentBookings.map(booking => (
              <Link
                key={booking.id}
                href={`/lender/bookings/${booking.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">Booking</p>
                  <p className="text-xs text-muted">
                    {new Date(booking.scheduled_start).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-semibold',
                  BOOKING_STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-muted'
                )}>
                  {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
