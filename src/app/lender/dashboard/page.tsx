import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { BookOpen, Zap, Clock } from 'lucide-react';

interface SearchParams {
  listed?: string;
  kyc?: string;
}

async function getLenderData(userId: string) {
  const adminSupabase = createAdminClient();

  const [userResult, chargersResult, bookingsResult, recentResult] = await Promise.all([
    adminSupabase
      .from('users')
      .select('id, name, kyc_status')
      .eq('id', userId)
      .single(),

    adminSupabase
      .from('chargers')
      .select('id, status')
      .eq('lender_id', userId)
      .is('deleted_at', null),

    adminSupabase
      .from('bookings')
      .select('status')
      .eq('lender_id', userId),

    adminSupabase
      .from('bookings')
      .select('id, status, scheduled_start, charger_id, driver_id')
      .eq('lender_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return {
    user: userResult.data as { id: string; name: string | null; kyc_status: string } | null,
    chargers: (chargersResult.data ?? []) as { id: string; status: string }[],
    bookings: (bookingsResult.data ?? []) as { status: string }[],
    recentBookings: (recentResult.data ?? []) as Array<{
      id: string;
      status: string;
      scheduled_start: string;
    }>,
  };
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  confirmed: 'bg-volt-soft text-volt-deep',
  active: 'bg-blue-50 text-blue-700',
  completed: 'bg-gray-100 text-muted',
  cancelled: 'bg-red-50 text-red-700',
  disputed: 'bg-orange-50 text-orange-700',
};

export default async function LenderDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { user: profile, chargers, bookings, recentBookings } = await getLenderData(user.id);

  if (!profile) redirect('/login');

  const kycStatus = (profile.kyc_status ?? 'not_started') as string;
  const activeChargers = chargers.filter(c => c.status === 'active').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;

  return (
    <main className="min-h-screen px-6 py-10 space-y-6">
      {/* Toast banners for actions */}
      {searchParams.listed === '1' && (
        <div className="px-4 py-3 bg-volt-soft rounded-2xl border border-volt">
          <p className="font-semibold text-ink">
            Charger listed!{' '}
            {kycStatus !== 'approved'
              ? 'It will be visible to drivers once you verify your identity in Profile.'
              : "It's now visible to drivers."}
          </p>
        </div>
      )}
      {searchParams.kyc === 'submitted' && (
        <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-200">
          <p className="font-semibold text-blue-800">KYC submitted! We&apos;ll review within 24–48 hours.</p>
        </div>
      )}

      {/* KYC notice — informational, chargers are hidden from drivers until verified */}
      {kycStatus === 'not_started' && (
        <div className="px-4 py-3 bg-yellow-50 rounded-2xl border border-yellow-200 flex items-center justify-between gap-3">
          <p className="text-sm text-yellow-800">
            Your chargers won&apos;t appear to drivers until you verify your identity.
          </p>
          <Link
            href="/profile"
            className="shrink-0 px-3 py-1.5 bg-yellow-700 text-white text-xs font-bold rounded-xl hover:bg-yellow-800 transition-colors"
          >
            Verify
          </Link>
        </div>
      )}

      {kycStatus === 'pending' && (
        <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-200">
          <p className="text-sm text-blue-800 font-semibold">Verification under review</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Usually 24–48 hours. Your chargers will go live once approved.
          </p>
        </div>
      )}

      {kycStatus === 'rejected' && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl border border-red-200 flex items-center justify-between gap-3">
          <p className="text-sm text-red-800">
            Verification rejected — resubmit clearer documents to publish your chargers.
          </p>
          <Link
            href="/profile"
            className="shrink-0 px-3 py-1.5 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors"
          >
            Resubmit
          </Link>
        </div>
      )}

      {/* Page heading */}
      <h1 className="font-display font-extrabold text-3xl text-ink">
        {profile.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Dashboard'}
      </h1>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-display font-extrabold text-ink">₹0</p>
          <p className="text-xs text-muted mt-1">This week</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-display font-extrabold text-ink">{activeChargers}</p>
          <p className="text-xs text-muted mt-1">Active</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-display font-extrabold text-ink">{pendingBookings}</p>
          <p className="text-xs text-muted mt-1">Pending</p>
        </div>
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
            href="/lender/chargers/new"
            className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-gray-200 transition-colors"
          >
            <Zap className="w-5 h-5 text-volt-deep" />
            <span className="font-semibold text-ink text-sm">Add a charger</span>
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

      {/* Recent activity */}
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
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-muted'}`}
                >
                  {booking.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
