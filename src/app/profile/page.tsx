import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ProfileBody } from '@/components/profile/ProfileBody';
import { PullToRefresh } from '@/components/ui/PullToRefresh';

type HostingState = 'not_enabled' | 'setup_in_progress' | 'setup_deferred' | 'active' | 'paused';

async function getProfileData(userId: string) {
  const adminSupabase = createAdminClient();

  const [userResult, submissionResult, chargersResult, lenderBookingsResult] = await Promise.all([
    adminSupabase
      .from('users')
      .select('id, name, phone, role, kyc_status, created_at, avatar_url, hosting_paused, hosting_setup_deferred, avg_rating')
      .eq('id', userId)
      .single(),

    adminSupabase
      .from('kyc_submissions')
      .select('id, status, submitted_at, rejection_reason')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    adminSupabase
      .from('chargers')
      .select('status')
      .eq('lender_id', userId)
      .is('deleted_at', null),

    adminSupabase
      .from('bookings')
      .select('id')
      .eq('lender_id', userId)
      .eq('status', 'completed'),
  ]);

  const chargers = (chargersResult.data ?? []) as { status: string }[];
  const chargerStats = {
    published: chargers.filter(c => c.status === 'active' || c.status === 'paused').length,
    visible:   chargers.filter(c => c.status === 'active').length,
    draft:     chargers.filter(c => c.status === 'draft').length,
  };

  // Lifetime earnings: sum lender_payout for all completed bookings
  let lifetimeEarningsPaise = 0;
  const bookingIds = (lenderBookingsResult.data ?? []).map(b => b.id as string);
  if (bookingIds.length > 0) {
    const { data: paymentsData } = await adminSupabase
      .from('payments')
      .select('lender_payout')
      .in('booking_id', bookingIds);
    lifetimeEarningsPaise = (paymentsData ?? []).reduce(
      (s, p) => s + (Number(p.lender_payout) || 0),
      0,
    );
  }

  return {
    user: userResult.data as {
      id: string; name: string | null; phone: string;
      role: string; kyc_status: string; created_at: string;
      avatar_url: string | null; hosting_paused: boolean;
      hosting_setup_deferred: boolean; avg_rating: number | null;
    } | null,
    userError: userResult.error,
    submission: submissionResult.data as {
      id: string; status: string; submitted_at: string; rejection_reason: string | null;
    } | null,
    chargerStats,
    lifetimeEarningsPaise,
  };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { verified?: string };
}) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const isAdmin = (user.user_metadata?.is_admin as boolean | undefined) ?? false;

  const {
    user: profile, userError, submission,
    chargerStats, lifetimeEarningsPaise,
  } = await getProfileData(user.id);

  // DB query error — don't redirect to /login since the user IS authenticated
  if (userError) throw new Error(userError.message);
  if (!profile) redirect('/login');

  // Derive hosting state from role + hosting_paused + published charger count
  const isHostingEnabled = profile.role === 'lender' || profile.role === 'both';
  const hostingState: HostingState = (() => {
    if (!isHostingEnabled) return 'not_enabled';
    if (chargerStats.published === 0) {
      return profile.hosting_setup_deferred ? 'setup_deferred' : 'setup_in_progress';
    }
    if (profile.hosting_paused) return 'paused';
    return 'active';
  })();

  // Defend against phantom-pending: kyc_status='pending' with no submission row
  const rawKycStatus = profile.kyc_status as string;
  const kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected' = (() => {
    if (rawKycStatus === 'pending' && !submission) return 'not_started';
    return rawKycStatus as 'not_started' | 'pending' | 'approved' | 'rejected';
  })();

  return (
    <>
      <main
        className="max-w-lg mx-auto"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <ProfileBody
          isAdmin={isAdmin}
          initialName={profile.name}
          phone={profile.phone}
          hostingState={hostingState}
          chargerStats={chargerStats}
          createdAt={profile.created_at}
          kycStatus={kycStatus}
          submission={submission}
          showSubmittedBanner={searchParams.verified === 'submitted'}
          initialAvatarUrl={profile.avatar_url}
          lifetimeEarningsPaise={lifetimeEarningsPaise}
          avgRating={profile.avg_rating}
        />
      </main>
      <PullToRefresh />
    </>
  );
}
