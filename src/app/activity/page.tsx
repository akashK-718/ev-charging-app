import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cn } from '@/lib/utils';

type BookingStatus = 'confirmed' | 'awaiting_driver_confirmation' | 'in_progress' | 'completed' | 'cancelled';

interface ActivityItem {
  id: string;
  kind: 'session' | 'booking';
  title: string;
  subtitle: string;
  status: BookingStatus | null;
  ts: string;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed:                    'Confirmed',
  awaiting_driver_confirmation: 'Awaiting confirmation',
  in_progress:                  'In progress',
  completed:                    'Completed',
  cancelled:                    'Cancelled',
};

const STATUS_COLOR: Record<BookingStatus, string> = {
  confirmed:                    'text-green bg-green-soft',
  awaiting_driver_confirmation: 'text-copper bg-copper-soft',
  in_progress:                  'text-green bg-green-soft',
  completed:                    'text-muted bg-surface-page',
  cancelled:                    'text-danger bg-danger-soft',
};

export default async function ActivityPage() {
  const supabase = createClient();
  const adminSupabase = createAdminClient();

  const { data: { user: rawUser } } = await supabase.auth.getUser();
  if (!rawUser) redirect('/login');

  const role = (rawUser.user_metadata?.role as string | undefined) ?? 'driver';
  const isDriver = role === 'driver' || role === 'both';
  const isLender = role === 'lender' || role === 'both';

  const items: ActivityItem[] = [];

  if (isDriver) {
    const { data: bookings } = await adminSupabase
      .from('bookings')
      .select('id, status, scheduled_start, charger_id, chargers(title)')
      .eq('driver_id', rawUser.id)
      .order('scheduled_start', { ascending: false })
      .limit(30);

    (bookings ?? []).forEach(b => {
      const chargerTitle = (b.chargers as { title?: string } | null)?.title ?? 'Charger';
      items.push({
        id: `driver-${b.id}`,
        kind: 'session',
        title: chargerTitle,
        subtitle: new Date(b.scheduled_start).toLocaleString('en-IN', {
          dateStyle: 'medium', timeStyle: 'short',
        }),
        status: b.status as BookingStatus,
        ts: b.scheduled_start,
      });
    });
  }

  if (isLender) {
    const { data: bookings } = await adminSupabase
      .from('bookings')
      .select('id, status, scheduled_start, charger_id, chargers(title)')
      .eq('lender_id', rawUser.id)
      .order('scheduled_start', { ascending: false })
      .limit(30);

    (bookings ?? []).forEach(b => {
      const chargerTitle = (b.chargers as { title?: string } | null)?.title ?? 'Charger';
      items.push({
        id: `lender-${b.id}`,
        kind: 'booking',
        title: chargerTitle,
        subtitle: new Date(b.scheduled_start).toLocaleString('en-IN', {
          dateStyle: 'medium', timeStyle: 'short',
        }),
        status: b.status as BookingStatus,
        ts: b.scheduled_start,
      });
    });
  }

  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-6">
        <h1 className="text-2xl font-bold text-ink mb-0.5">Activity</h1>
        <p className="text-sm text-muted mb-7">Your sessions and bookings in one place.</p>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted">No activity yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-4 rounded-token bg-surface-card border border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono font-semibold tracking-widest uppercase text-muted">
                      {item.kind === 'session' ? 'Session' : 'Hosting'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-ink truncate">{item.title}</p>
                  <p className="text-xs text-muted mt-0.5">{item.subtitle}</p>
                </div>
                {item.status && (
                  <span className={cn(
                    'shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-pill',
                    STATUS_COLOR[item.status],
                  )}>
                    {STATUS_LABEL[item.status]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
