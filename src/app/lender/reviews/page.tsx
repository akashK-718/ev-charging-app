import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const filled = Math.round(rating);
  const cls = size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(cls, i < filled ? 'fill-[#10d96a] text-[#10d96a]' : 'fill-none text-border')}
          aria-hidden
        />
      ))}
    </div>
  );
}

export default async function HostReviewsPage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/auth');

  const admin = createAdminClient();

  const { data: profileData } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if ((profileData as { role: string } | null)?.role !== 'lender') redirect('/profile');

  const { data: rawReviews } = await admin
    .from('reviews')
    .select('id, booking_id, charger_id, reviewer_id, rating, created_at')
    .eq('reviewee_id', user.id)
    .eq('review_type', 'lender')
    .order('created_at', { ascending: false });

  const reviews = (rawReviews ?? []) as Array<{
    id: string; booking_id: string; charger_id: string;
    reviewer_id: string; rating: number; created_at: string;
  }>;

  const allBookingIds = [...new Set(reviews.map(r => r.booking_id))];
  const allChargerIds = [...new Set(reviews.map(r => r.charger_id))];
  const allUserIds    = [...new Set(reviews.map(r => r.reviewer_id))];

  const [bookingsRes, chargersRes, usersRes] = await Promise.all([
    allBookingIds.length
      ? admin.from('bookings').select('id, scheduled_start').in('id', allBookingIds)
      : Promise.resolve({ data: [] as Array<{ id: string; scheduled_start: string }> }),
    allChargerIds.length
      ? admin.from('chargers').select('id, title').in('id', allChargerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    allUserIds.length
      ? admin.from('users').select('id, name').in('id', allUserIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);

  const bookingMap = new Map(((bookingsRes.data ?? []) as Array<{ id: string; scheduled_start: string }>).map(b => [b.id, b.scheduled_start]));
  const chargerMap = new Map(((chargersRes.data ?? []) as Array<{ id: string; title: string }>).map(c => [c.id, c.title]));
  const userMap    = new Map(((usersRes.data ?? []) as Array<{ id: string; name: string | null }>).map(u => [u.id, u.name]));

  const totalCount = reviews.length;
  const avgRating  = totalCount > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalCount
    : null;

  const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews) dist[Math.min(5, Math.max(1, r.rating))]++;

  return (
    <main className="max-w-lg mx-auto pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] lg:pb-10">
      <PageHeader title="Host Reviews" href="/lender/dashboard" aria-label="Back to dashboard" />

      {totalCount === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 px-4">
          <div className="size-14 rounded-2xl bg-green-soft text-green-deep grid place-items-center">
            <Star className="w-6 h-6" />
          </div>
          <p className="text-sm text-muted text-center max-w-[240px]">
            Driver reviews appear here after completed charging sessions.
          </p>
        </div>
      ) : (
        <div className="space-y-6 px-4">
          {/* Summary card */}
          <div className="bg-white border border-border rounded-3xl p-6">
            <div className="flex items-center gap-5 mb-5">
              <p className="text-5xl font-bold text-ink leading-none tabular-nums">
                {avgRating!.toFixed(1)}
              </p>
              <div>
                <StarRow rating={avgRating!} size="md" />
                <p className="text-xs text-muted mt-1.5">
                  {totalCount} {totalCount === 1 ? 'review' : 'reviews'}
                </p>
              </div>
            </div>

            {/* Star distribution */}
            <div className="space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map(star => {
                const count = dist[star];
                const pct   = totalCount > 0 ? (count / totalCount) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-muted w-3 shrink-0 text-right">{star}</span>
                    <Star className="w-3 h-3 fill-muted text-muted shrink-0" aria-hidden />
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#10d96a] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted w-4 shrink-0 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Review list */}
          <div>
            <p className="text-[11px] font-semibold tracking-wider uppercase text-muted mb-3">
              All reviews
            </p>
            <div className="space-y-3">
              {reviews.map(r => (
                <Link
                  key={r.id}
                  href={`/lender/bookings/${r.booking_id}`}
                  className="block bg-white border border-border rounded-2xl px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {userMap.get(r.reviewer_id) ?? 'A driver'}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {chargerMap.get(r.charger_id) ?? 'Charger'} · {fmtDate(bookingMap.get(r.booking_id) ?? r.created_at)}
                      </p>
                    </div>
                    <StarRow rating={r.rating} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
