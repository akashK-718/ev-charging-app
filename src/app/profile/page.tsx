import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ShieldCheck, ShieldX, Clock, ShieldAlert } from 'lucide-react';
import { NameEditor } from '@/components/profile/NameEditor';
import { RoleEditor } from '@/components/profile/RoleEditor';

async function getProfileData(userId: string) {
  const adminSupabase = createAdminClient();

  const [userResult, submissionResult, draftResult] = await Promise.all([
    adminSupabase
      .from('users')
      .select('id, name, phone, role, kyc_status, created_at')
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
    } | null,
    submission: submissionResult.data as {
      id: string; status: string; submitted_at: string; rejection_reason: string | null;
    } | null,
    draftCount: draftResult.count ?? 0,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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

  const isLender = profile.role === 'lender' || profile.role === 'both';

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

      {/* Submission success toast — only while still pending; hide once approved/rejected */}
      {searchParams.verified === 'submitted' && kycStatus === 'pending' && (
        <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-200">
          <p className="font-semibold text-blue-800">Verification submitted!</p>
          <p className="text-sm text-blue-700 mt-0.5">We&apos;ll review your documents within 24–48 hours.</p>
        </div>
      )}

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-base text-ink">Account</h2>
        <div className="space-y-3">
          <NameEditor initialName={profile.name} />
          <div>
            <p className="text-xs text-muted mb-0.5">Phone</p>
            <p className="text-sm font-semibold text-ink">{profile.phone}</p>
            {/* TODO: Implement phone change flow in future PR (Module 5+) */}
            {/* Requires: OTP verification on both numbers, uniqueness check, auth provider sync */}
            <p className="text-xs text-muted mt-1">
              To change your phone number,{' '}
              <a href="mailto:support@example.com" className="underline hover:text-ink transition-colors">
                contact support
              </a>
              .
            </p>
          </div>
          <RoleEditor initialRole={profile.role as 'driver' | 'lender' | 'both'} />
          <div>
            <p className="text-xs text-muted mb-0.5">Member since</p>
            <p className="text-sm font-semibold text-ink">{formatDate(profile.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Identity verification — lenders only */}
      {isLender && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-base text-ink">Identity verification</h2>

          {kycStatus === 'not_started' && (
            <div className="space-y-4">
              <div className="flex gap-3 p-4 rounded-xl border bg-yellow-50 border-yellow-200">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600" />
                <div>
                  <p className="font-semibold text-sm text-yellow-700">Not verified</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {draftCount > 0
                      ? `You have ${draftCount} charger${draftCount > 1 ? 's' : ''} awaiting publish. Verify your identity to make them visible to drivers.`
                      : 'Verify your identity to publish chargers and receive payouts.'}
                  </p>
                </div>
              </div>
              <Link
                href="/profile/verify"
                className="block w-full text-center px-4 py-3 bg-ink text-white text-sm font-bold rounded-2xl hover:bg-ink/90 transition-colors"
              >
                Start verification
              </Link>
            </div>
          )}

          {kycStatus === 'pending' && submission && (
            <div className="flex gap-3 p-4 rounded-xl border bg-blue-50 border-blue-200">
              <Clock className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
              <div>
                <p className="font-semibold text-sm text-blue-700">Under review</p>
                <p className="text-xs text-muted mt-1">
                  Submitted {formatDate(submission.submitted_at)} · Usually 24–48 hours.
                  {draftCount > 0 && ` Your ${draftCount} charger${draftCount > 1 ? 's' : ''} will go live automatically once approved.`}
                </p>
              </div>
            </div>
          )}

          {kycStatus === 'approved' && (
            <div className="flex gap-3 p-4 rounded-xl border bg-green-50 border-green-200">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />
              <div>
                <p className="font-semibold text-sm text-green-700">Verified</p>
                {submission && (
                  <p className="text-xs text-muted mt-1">Verified on {formatDate(submission.submitted_at)}</p>
                )}
              </div>
            </div>
          )}

          {kycStatus === 'rejected' && (
            <div className="space-y-4">
              <div className="flex gap-3 p-4 rounded-xl border bg-red-50 border-red-200">
                <ShieldX className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p className="font-semibold text-sm text-red-700">Verification rejected</p>
                  {submission?.rejection_reason && (
                    <p className="text-xs text-muted mt-1">Reason: {submission.rejection_reason}</p>
                  )}
                  <p className="text-xs text-muted mt-1">Please resubmit with clearer, well-lit photos.</p>
                </div>
              </div>
              <Link
                href="/profile/verify"
                className="block w-full text-center px-4 py-3 bg-red-700 text-white text-sm font-bold rounded-2xl hover:bg-red-800 transition-colors"
              >
                Resubmit documents
              </Link>
            </div>
          )}

          <p className="text-xs text-muted">
            We collect Aadhaar and PAN for identity verification as required by Indian payment regulations.
            Documents are reviewed by our team and not shared with third parties.
          </p>
        </div>
      )}
    </main>
  );
}
