import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<string, string> = {
  booking_confirmed:    'Booking confirmed',
  booking_cancelled:    'Booking cancelled',
  booking_started:      'Session started',
  booking_ended:        'Session ended',
  payout_processed:     'Payout processed',
  kyc_approved:         'KYC approved',
  kyc_rejected:         'KYC rejected',
};

function notificationTitle(type: string, data: Record<string, unknown>): string {
  return TYPE_LABEL[type] ?? type.replace(/_/g, ' ');
}

function notificationBody(type: string, data: Record<string, unknown>): string {
  if (type === 'booking_confirmed') return `Your booking has been confirmed.`;
  if (type === 'booking_cancelled') return `A booking was cancelled.`;
  if (type === 'booking_started')   return `Your charging session has started.`;
  if (type === 'booking_ended')     return `Your session is complete.`;
  if (type === 'payout_processed')  return `Your payout has been processed.`;
  if (type === 'kyc_approved')      return `Your KYC has been approved.`;
  if (type === 'kyc_rejected')      return `Your KYC was rejected. Please resubmit.`;
  return '';
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function NotificationsPage() {
  const supabase = createClient();
  const adminSupabase = createAdminClient();

  const { data: { user: rawUser } } = await supabase.auth.getUser();
  if (!rawUser) redirect('/login');

  const { data: notifications } = await adminSupabase
    .from('notifications')
    .select('*')
    .eq('user_id', rawUser.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-6">
        <h1 className="text-2xl font-bold text-ink mb-0.5">Notifications</h1>
        <p className="text-sm text-muted mb-7">Updates from your bookings and activity.</p>

        {(!notifications || notifications.length === 0) ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted">No notifications yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map(n => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-4 rounded-token border',
                  n.read
                    ? 'bg-surface-card border-border'
                    : 'bg-green-soft border-green/20',
                )}
              >
                {!n.read && (
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green shrink-0" aria-label="Unread" />
                )}
                {n.read && <span className="mt-1.5 w-1.5 h-1.5 shrink-0" aria-hidden />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {notificationTitle(n.type, n.data as Record<string, unknown>)}
                  </p>
                  {notificationBody(n.type, n.data as Record<string, unknown>) && (
                    <p className="text-xs text-muted mt-0.5">
                      {notificationBody(n.type, n.data as Record<string, unknown>)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
