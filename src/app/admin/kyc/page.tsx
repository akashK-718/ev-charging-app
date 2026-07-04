import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

type TabStatus = 'pending' | 'approved' | 'rejected' | 'resubmission_required' | 'all';

const TABS: Array<{ value: TabStatus; label: string }> = [
  { value: 'pending',                label: 'Pending' },
  { value: 'approved',               label: 'Approved' },
  { value: 'rejected',               label: 'Rejected' },
  { value: 'resubmission_required',  label: 'Resubmission' },
  { value: 'all',                    label: 'All' },
];

const STATUS_COLORS: Record<string, string> = {
  pending:                'bg-yellow-50 text-yellow-700',
  approved:               'bg-green-50 text-green-700',
  rejected:               'bg-red-50 text-red-700',
  resubmission_required:  'bg-blue-50 text-blue-700',
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${mins}m ago`;
}

export default async function AdminKycQueuePage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const rawTab = (searchParams.status ?? 'pending') as TabStatus;
  const tab: TabStatus = TABS.some(t => t.value === rawTab) ? rawTab : 'pending';

  const admin = createAdminClient();

  let query = admin
    .from('kyc_submissions')
    .select('id, user_id, status, submitted_at, reviewed_at')
    .order('submitted_at', { ascending: true });

  if (tab !== 'all') {
    query = query.eq('status', tab);
  }

  const { data: submissions } = await query;
  const rawList = (submissions ?? []) as Array<{
    id: string; user_id: string; status: string; submitted_at: string; reviewed_at: string | null;
  }>;

  const userIds = [...new Set(rawList.map(s => s.user_id))];

  const [usersRes, draftsRes] = await Promise.all([
    userIds.length > 0
      ? admin.from('users').select('id, phone, name').in('id', userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; phone: string; name: string | null }> }),
    userIds.length > 0
      ? admin.from('chargers').select('id, lender_id').in('lender_id', userIds).eq('status', 'draft').is('deleted_at', null)
      : Promise.resolve({ data: [] as Array<{ id: string; lender_id: string }> }),
  ]);

  const userMap = new Map(
    (usersRes.data ?? []).map(u => [u.id, u] as [string, { id: string; phone: string; name: string | null }]),
  );

  const draftCountMap = new Map<string, number>();
  for (const charger of (draftsRes.data ?? []) as Array<{ id: string; lender_id: string }>) {
    draftCountMap.set(charger.lender_id, (draftCountMap.get(charger.lender_id) ?? 0) + 1);
  }

  return (
    <main className="min-h-screen px-6 py-10 space-y-5">
      <h1 className="font-display font-extrabold text-3xl text-ink">KYC queue</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        {TABS.map(t => (
          <Link
            key={t.value}
            href={`/admin/kyc?status=${t.value}`}
            className={cn(
              'shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
              tab === t.value
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-gray-200 text-muted hover:text-ink',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rawList.length === 0 ? (
        <p className="text-sm text-muted py-4">No submissions.</p>
      ) : (
        <div className="space-y-2">
          {rawList.map(sub => {
            const u = userMap.get(sub.user_id);
            const drafts = draftCountMap.get(sub.user_id) ?? 0;
            return (
              <Link
                key={sub.id}
                href={`/admin/kyc/${sub.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-3 hover:border-gray-200 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">{u?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-muted">{u?.phone ?? '—'}</p>
                  {drafts > 0 && (
                    <p className="text-xs text-amber-700 mt-0.5">
                      {drafts} draft charger{drafts !== 1 ? 's' : ''} pending
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <span className={cn(
                    'inline-block px-2 py-0.5 rounded-full text-xs font-semibold',
                    STATUS_COLORS[sub.status] ?? 'bg-gray-100 text-muted',
                  )}>
                    {sub.status.replace('_', ' ')}
                  </span>
                  <p className="text-xs text-muted">{timeAgo(sub.submitted_at)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
