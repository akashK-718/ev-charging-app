import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ProfileBody } from '@/components/profile/ProfileBody';

async function getProfileData(userId: string) {
  const adminSupabase = createAdminClient();

  const [userResult, submissionResult, draftResult] = await Promise.all([
    adminSupabase
      .from('users')
      .select('id, name, phone, role, kyc_status, created_at, avatar_url')
      .eq('id', userId)
      .single(),

    // Fetch the most recent submission to show accurate status + date
    adminSupabase
      .from('kyc_submissions')
      .select('id, status, submitted_at, rejection_reason')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Draft charger count
    adminSupabase
      .from('chargers')
      .select('id', { count: 'exact', head: true })
      .eq('lender_id', userId)
      .eq('status', 'draft')
      .is('deleted_at', null),
  ]);

  return {
    user: userResult.data as {
      id: string; name: string | null; phone: string;
      role: string; kyc_status: string; created_at: string;
      avatar_url: string | null;
    } | null,
    submission: submissionResult.data as {
      id: string; status: string; submitted_at: string; rejection_reason: string | null;
    } | null,
    draftCount: draftResult.count ?? 0,
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

  const { user: profile, submission, draftCount } = await getProfileData(user.id);
  if (!profile) redirect('/login');

  // Derive effective KYC status from DB (migration 009 fixes phantom-pending, but be defensive)
  // If user has kyc_status='pending' but no submission row → treat as not_started
  const rawKycStatus = profile.kyc_status as string;
  const kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected' = (() => {
    if (rawKycStatus === 'pending' && !submission) return 'not_started';
    return rawKycStatus as 'not_started' | 'pending' | 'approved' | 'rejected';
  })();

  return (
    <main className="min-h-screen px-6 py-10 space-y-6 max-w-lg mx-auto">
      <h1 className="font-display font-extrabold text-3xl text-ink">Profile</h1>

      <ProfileBody
        initialName={profile.name}
        phone={profile.phone}
        initialRole={profile.role as 'driver' | 'lender' | 'both'}
        createdAt={profile.created_at}
        kycStatus={kycStatus}
        submission={submission}
        draftCount={draftCount}
        showSubmittedBanner={searchParams.verified === 'submitted'}
        initialAvatarUrl={profile.avatar_url}
      />
    </main>
  );
}
