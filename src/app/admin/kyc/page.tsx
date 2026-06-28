import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';

type KycSubmission = {
  id: string;
  user_id: string;
  pan_number: string;
  aadhaar_last_4: string;
  status: string;
  submitted_at: string;
  users: { phone: string | null; name: string | null } | null;
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 1000 / 60 / 60);
  const m = Math.floor((diff / 1000 / 60) % 60);
  if (h > 0) return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

export default async function AdminKycQueuePage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile as { role: string }).role !== 'admin') {
    redirect('/');
  }

  const { data: submissions } = await adminSupabase
    .from('kyc_submissions')
    .select('id, user_id, pan_number, aadhaar_last_4, status, submitted_at')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });

  // Enrich with user info
  const rawList = (submissions ?? []) as Array<{
    id: string; user_id: string; pan_number: string; aadhaar_last_4: string;
    status: string; submitted_at: string;
  }>;

  const userIds = [...new Set(rawList.map(s => s.user_id))];
  const { data: usersData } = userIds.length > 0
    ? await adminSupabase.from('users').select('id, phone, name').in('id', userIds)
    : { data: [] };
  const userMap = new Map((usersData ?? []).map(u => [u.id, u] as [string, { id: string; phone: string; name: string | null }]));

  const list: KycSubmission[] = rawList.map(s => ({
    ...s,
    users: userMap.get(s.user_id) ? { phone: userMap.get(s.user_id)!.phone, name: userMap.get(s.user_id)!.name } : null,
  }));

  return (
    <main className="min-h-screen px-6 py-10">
      <h1 className="font-display font-extrabold text-3xl text-ink mb-2">KYC queue</h1>
      <p className="text-muted mb-6">
        {list.length === 0
          ? 'No pending submissions.'
          : `${list.length} pending submission${list.length !== 1 ? 's' : ''} — oldest first`}
      </p>

      {list.length > 0 && (
        <div className="space-y-2">
          {list.map(sub => {
            const phone = sub.users?.phone ?? '—';
            const name = sub.users?.name ?? 'Unknown';
            return (
              <Link
                key={sub.id}
                href={`/admin/kyc/${sub.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 transition-colors"
              >
                <div>
                  <p className="font-semibold text-ink text-sm">{name}</p>
                  <p className="text-xs text-muted">{phone}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700">
                    pending
                  </span>
                  <p className="text-xs text-muted mt-1">{timeAgo(sub.submitted_at)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
