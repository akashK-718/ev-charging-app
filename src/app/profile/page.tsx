import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ProfileBody } from '@/components/profile/ProfileBody';
import { ProfileMenuDrawer } from '@/components/profile/ProfileMenuDrawer';
import { PullToRefresh } from '@/components/ui/PullToRefresh';

type HostingState = 'not_enabled' | 'setup_in_progress' | 'setup_deferred' | 'active' | 'paused';

async function getProfileData(userId: string) {
  const adminSupabase = createAdminClient();

  const [userResult, submissionResult, chargersResult] = await Promise.all([
    adminSupabase
      .from('users')
      .select('id, name, phone, role, kyc_status, created_at, avatar_url, hosting_paused, hosting_setup_deferred')
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
  ]);

  const chargers = (chargersResult.data ?? []) as { status: string }[];
  const chargerStats = {
    published: chargers.filter(c => c.status === 'active' || c.status === 'paused').length,
    visible:   chargers.filter(c => c.status === 'active').length,
    draft:     chargers.filter(c => c.status === 'draft').length,
  };

  return {
    user: userResult.data as {
      id: string; name: string | null; phone: string;
      role: string; kyc_status: string; created_at: string;
      avatar_url: string | null; hosting_paused: boolean; hosting_setup_deferred: boolean;
    } | null,
    submission: submissionResult.data as {
      id: string; status: string; submitted_at: string; rejection_reason: string | null;
    } | null,
    chargerStats,
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

  const { user: profile, submission, chargerStats } = await getProfileData(user.id);
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
      <main className="min-h-screen px-6 py-10 space-y-6 max-w-lg mx-auto" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-ink">Profile</h1>
          <ProfileMenuDrawer isAdmin={isAdmin} />
        </div>

        <ProfileBody
          initialName={profile.name}
          phone={profile.phone}
          hostingState={hostingState}
          chargerStats={chargerStats}
          createdAt={profile.created_at}
          kycStatus={kycStatus}
          submission={submission}
          showSubmittedBanner={searchParams.verified === 'submitted'}
          initialAvatarUrl={profile.avatar_url}
        />
      </main>
      <PullToRefresh />
    </>
  );
}
