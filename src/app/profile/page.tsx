import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ShieldCheck, ShieldX, Clock, ShieldAlert } from 'lucide-react';

async function getProfileData(userId: string) {
  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from('users')
    .select('id, name, phone, role, kyc_status')
    .eq('id', userId)
    .single();
  return data as {
    id: string;
    name: string | null;
    phone: string;
    role: string;
    kyc_status: string;
  } | null;
}

const KYC_CONFIG = {
  not_started: {
    icon: ShieldAlert,
    iconClass: 'text-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
    title: 'Identity not verified',
    body: 'Your chargers are saved but hidden from drivers. Complete verification to publish them.',
    action: { href: '/lender/kyc', label: 'Start verification', className: 'bg-yellow-700 hover:bg-yellow-800' },
  },
  pending: {
    icon: Clock,
    iconClass: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    title: 'Verification under review',
    body: 'We\'re reviewing your documents — usually 24–48 hours. Your chargers will go live once approved.',
    action: null,
  },
  approved: {
    icon: ShieldCheck,
    iconClass: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    title: 'Identity verified',
    body: 'Your chargers are visible to drivers and you can receive payouts.',
    action: null,
  },
  rejected: {
    icon: ShieldX,
    iconClass: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    title: 'Verification rejected',
    body: 'Please resubmit with clearer, well-lit photos of your documents.',
    action: { href: '/lender/kyc', label: 'Resubmit documents', className: 'bg-red-700 hover:bg-red-800' },
  },
} as const;

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect('/login');

  const profile = await getProfileData(user.id);
  if (!profile) redirect('/login');

  const isLender = profile.role === 'lender' || profile.role === 'both';
  const kycStatus = (profile.kyc_status ?? 'not_started') as keyof typeof KYC_CONFIG;
  const kyc = KYC_CONFIG[kycStatus] ?? KYC_CONFIG.not_started;
  const KycIcon = kyc.icon;

  return (
    <main className="min-h-screen px-6 py-10 space-y-6 max-w-lg mx-auto">
      <h1 className="font-display font-extrabold text-3xl text-ink">Profile</h1>

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-base text-ink">Account</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted mb-0.5">Name</p>
            <p className="text-sm font-semibold text-ink">{profile.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted mb-0.5">Phone</p>
            <p className="text-sm font-semibold text-ink">{profile.phone}</p>
          </div>
          <div>
            <p className="text-xs text-muted mb-0.5">Role</p>
            <p className="text-sm font-semibold text-ink capitalize">{profile.role}</p>
          </div>
        </div>
      </div>

      {/* Identity verification — lenders only */}
      {isLender && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-base text-ink">Identity verification</h2>

          <div className={`flex gap-3 p-4 rounded-xl border ${kyc.bg}`}>
            <KycIcon className={`w-5 h-5 shrink-0 mt-0.5 ${kyc.iconClass}`} />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${kyc.iconClass}`}>{kyc.title}</p>
              <p className="text-xs text-muted mt-1 leading-relaxed">{kyc.body}</p>
              {kyc.action && (
                <Link
                  href={kyc.action.href}
                  className={`inline-block mt-3 px-4 py-2 text-white text-xs font-bold rounded-xl transition-colors ${kyc.action.className}`}
                >
                  {kyc.action.label}
                </Link>
              )}
            </div>
          </div>

          <p className="text-xs text-muted">
            We collect Aadhaar and PAN for identity verification as required by Indian payment regulations.
            Documents are reviewed by our team and not shared with third parties.
          </p>
        </div>
      )}
    </main>
  );
}
