'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types (shared with server page) ──────────────────────────────────────────

export type HistoryItem = {
  id: string;
  kind: 'charging' | 'hosting';
  bookingId: string;
  chargerTitle: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string | null;
};

export type UpdateItem = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  read: boolean;
};

type TabType    = 'history' | 'updates';
type FilterType = 'all' | 'upcoming' | 'completed' | 'cancelled';

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Status display ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  confirmed:                    'Confirmed',
  awaiting_driver_confirmation: 'Awaiting confirmation',
  pending:                      'Pending',
  in_progress:                  'In progress',
  completed:                    'Completed',
  cancelled:                    'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  confirmed:                    'text-green bg-green-soft',
  awaiting_driver_confirmation: 'text-copper bg-copper-soft',
  pending:                      'text-copper bg-copper-soft',
  in_progress:                  'text-green bg-green-soft',
  completed:                    'text-muted bg-surface-page',
  cancelled:                    'text-danger bg-danger-soft',
};

// ── Notification display ──────────────────────────────────────────────────────

const NOTIF_LABEL: Record<string, string> = {
  booking_received:             'New booking request',
  booking_accepted:             'Booking confirmed',
  booking_rejected:             'Booking declined',
  booking_auto_rejected:        'Booking expired',
  booking_cancelled:            'Booking cancelled',
  booking_no_show:              'No-show recorded',
  session_initiation_requested: 'Session start requested',
  session_started:              'Session started',
  session_end_requested:        'Session end requested',
  session_completed:            'Session completed',
  kyc_approved:                 'Verification approved',
  kyc_rejected:                 'Verification rejected',
  kyc_resubmission_required:    'Verification update needed',
  payout_processed:             'Payout processed',
};

function notifBody(type: string, data: Record<string, unknown>): string {
  const charger = (data.charger_title as string | undefined) ?? '';
  const driver  = (data.driver_name  as string | undefined) ?? '';
  switch (type) {
    case 'booking_received':
      return charger
        ? `New request for ${charger}${driver ? ` from ${driver}` : ''}`
        : 'You have a new booking request';
    case 'booking_accepted':
      return charger ? `Your booking at ${charger} has been confirmed` : 'Your booking has been confirmed';
    case 'booking_rejected':
      return charger ? `Your booking at ${charger} was not accepted` : 'Your booking was not accepted';
    case 'booking_auto_rejected':
      return 'The booking request was not accepted in time';
    case 'booking_cancelled':
      return charger ? `Booking at ${charger} was cancelled` : 'A booking was cancelled';
    case 'booking_no_show':
      return 'A no-show was recorded for this booking';
    case 'session_initiation_requested':
      return charger ? `Session start requested at ${charger}` : 'Session start has been requested';
    case 'session_started':
      return charger ? `Your charging session at ${charger} has started` : 'Your charging session has started';
    case 'session_end_requested':
      return 'Session end has been requested';
    case 'session_completed':
      return charger ? `Your session at ${charger} is complete` : 'Your session is complete';
    case 'kyc_approved':
      return 'Your identity verification has been approved';
    case 'kyc_rejected':
      return 'Your verification was rejected. Please resubmit in Profile';
    case 'kyc_resubmission_required':
      return 'Please update your verification documents in Profile';
    case 'payout_processed':
      return 'Your payout has been transferred';
    default:
      return '';
  }
}

// ── Grouping ──────────────────────────────────────────────────────────────────

type DateGroup = { label: string; items: HistoryItem[] };

function groupByDate(items: HistoryItem[]): DateGroup[] {
  const todayStart     = new Date(); todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart  = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const buckets: Record<'upcoming' | 'today' | 'yesterday' | 'earlier', HistoryItem[]> = {
    upcoming:  [],
    today:     [],
    yesterday: [],
    earlier:   [],
  };

  for (const item of items) {
    const d = new Date(item.scheduledStart);
    if      (d >= tomorrowStart)  buckets.upcoming.push(item);
    else if (d >= todayStart)     buckets.today.push(item);
    else if (d >= yesterdayStart) buckets.yesterday.push(item);
    else                          buckets.earlier.push(item);
  }

  // Upcoming sorted soonest-first; all others come in DESC from the server
  buckets.upcoming.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  return (
    [
      { label: 'Upcoming',   items: buckets.upcoming   },
      { label: 'Today',      items: buckets.today      },
      { label: 'Yesterday',  items: buckets.yesterday  },
      { label: 'Earlier',    items: buckets.earlier    },
    ] satisfies DateGroup[]
  ).filter(g => g.items.length > 0);
}

// ── Filtering ─────────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<FilterType, string> = {
  all:       'All',
  upcoming:  'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function applyFilter(items: HistoryItem[], filter: FilterType): HistoryItem[] {
  if (filter === 'all') return items;
  const now = new Date().toISOString();
  if (filter === 'upcoming') {
    return items.filter(i =>
      i.status === 'in_progress' ||
      (['confirmed', 'pending', 'awaiting_driver_confirmation'].includes(i.status) &&
        i.scheduledStart > now),
    );
  }
  if (filter === 'completed') return items.filter(i => i.status === 'completed');
  if (filter === 'cancelled') return items.filter(i => i.status === 'cancelled');
  return items;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  historyItems:      HistoryItem[];
  updates:           UpdateItem[];
  initialUnreadCount: number;
}

export function ActivityView({ historyItems, updates, initialUnreadCount }: Props) {
  const [tab,        setTab]        = useState<TabType>('history');
  const [filter,     setFilter]     = useState<FilterType>('all');
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [markedRead, setMarkedRead] = useState(false);

  // Mark all notifications read when the Updates tab is first opened
  useEffect(() => {
    if (tab === 'updates' && !markedRead && unreadCount > 0) {
      setMarkedRead(true);
      fetch('/api/activity/mark-updates-read', { method: 'POST' })
        .then(() => setUnreadCount(0))
        .catch(() => {});
    }
  }, [tab, markedRead, unreadCount]);

  const filtered = applyFilter(historyItems, filter);
  const grouped  = groupByDate(filtered);

  return (
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-6">

        <h1 className="text-2xl font-medium text-ink mb-5">Activity</h1>

        {/* Segmented tab control */}
        <div className="flex bg-surface-page border border-border rounded-token-lg p-1 gap-1 mb-6">
          {(['history', 'updates'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-token transition-colors',
                tab === t
                  ? 'bg-surface-card text-ink'
                  : 'text-muted hover:text-ink-soft',
              )}
            >
              {t === 'history' ? 'History' : 'Updates'}
              {t === 'updates' && unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-copper text-white rounded-pill leading-[18px] text-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── History ── */}
        {tab === 'history' && (
          <div>
            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-4">
              {(['all', 'upcoming', 'completed', 'cancelled'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'shrink-0 px-3.5 py-1.5 text-sm font-semibold rounded-token border transition-colors',
                    filter === f
                      ? 'bg-ink text-white border-ink'
                      : 'bg-surface-card text-muted border-border hover:border-ink-soft hover:text-ink',
                  )}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>

            {grouped.length === 0 ? (
              <div className="py-16 text-center">
                {filter === 'all' ? (
                  <>
                    <p className="text-sm font-semibold text-ink mb-1">No activity yet</p>
                    <p className="text-xs text-muted">
                      Your charging sessions and hosting history will appear here
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-ink mb-1">Nothing here</p>
                    <p className="text-xs text-muted">
                      No {FILTER_LABELS[filter].toLowerCase()} bookings found
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-6 pb-6">
                {grouped.map(({ label, items }) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-muted tracking-wider uppercase mb-2 px-0.5">
                      {label}
                    </p>
                    <div className="bg-surface-card border border-border rounded-token-lg overflow-hidden divide-y divide-border">
                      {items.map(item => {
                        const href = item.kind === 'charging'
                          ? `/bookings/${item.bookingId}`
                          : `/lender/bookings/${item.bookingId}`;
                        const statusLabel = STATUS_LABEL[item.status];
                        const statusColor = STATUS_COLOR[item.status] ?? 'text-muted bg-surface-page';
                        return (
                          <Link
                            key={item.id}
                            href={href}
                            className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold tracking-wider uppercase text-muted mb-0.5">
                                {item.kind === 'charging' ? 'Charging' : 'Hosting'}
                              </p>
                              <p className="text-sm font-semibold text-ink truncate">
                                {item.chargerTitle}
                              </p>
                              <p className="text-xs text-muted mt-0.5">
                                {fmtDate(item.scheduledStart)} at {fmtTime(item.scheduledStart)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {statusLabel && (
                                <span className={cn(
                                  'text-[10.5px] font-semibold px-2 py-0.5 rounded-token',
                                  statusColor,
                                )}>
                                  {statusLabel}
                                </span>
                              )}
                              <ChevronRight className="w-4 h-4 text-muted" aria-hidden />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Updates ── */}
        {tab === 'updates' && (
          <div>
            {updates.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-ink mb-1">No updates yet</p>
                <p className="text-xs text-muted">
                  Booking confirmations, session events, and account updates will appear here
                </p>
              </div>
            ) : (
              <div className="bg-surface-card border border-border rounded-token-lg overflow-hidden divide-y divide-border mb-6">
                {updates.map(u => (
                  <div
                    key={u.id}
                    className="flex items-start gap-3 px-4 py-3.5"
                  >
                    <span
                      className={cn(
                        'mt-[5px] w-1.5 h-1.5 rounded-full shrink-0',
                        u.read ? 'opacity-0' : 'bg-green',
                      )}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm text-ink',
                        u.read ? 'font-medium' : 'font-semibold',
                      )}>
                        {NOTIF_LABEL[u.type] ?? u.type.replace(/_/g, ' ')}
                      </p>
                      {notifBody(u.type, u.data) && (
                        <p className="text-xs text-muted mt-0.5 leading-relaxed">
                          {notifBody(u.type, u.data)}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted mt-0.5 whitespace-nowrap">
                      {timeAgo(u.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
