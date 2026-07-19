'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Bell, CalendarCheck, CreditCard, Home, Info, Star, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types (shared with server page) ──────────────────────────────────────────

export type HistoryItem = {
  id: string;
  kind: 'charging' | 'hosting';
  bookingId: string;
  chargerId: string;
  chargerTitle: string;
  chargerPhoto: string | null;
  chargerLat: number | null;
  chargerLng: number | null;
  counterpartyName: string | null;
  displayAmountPaise: number | null;
  hasRated: boolean;
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

// ── Internal feed types ───────────────────────────────────────────────────────

type ActivityKind = 'booking' | 'session' | 'payment' | 'payout' | 'host' | 'notice';

type FeedItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  amount?: number;
  amountSign?: '+' | '-';
  tag?: string;
  isoTime: string;
  href?: string;
};

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

function fmtAmount(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

// ── Kind mapping ──────────────────────────────────────────────────────────────

function historyKind(item: HistoryItem): ActivityKind {
  if (item.kind === 'charging') {
    if (item.status === 'completed')   return 'payment';
    if (item.status === 'in_progress') return 'session';
    return 'booking';
  }
  if (item.status === 'completed') return 'payout';
  return 'host';
}

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

// ── Feed builder ──────────────────────────────────────────────────────────────

function buildFeed(historyItems: HistoryItem[], updates: UpdateItem[]): FeedItem[] {
  const items: FeedItem[] = [];

  for (const h of historyItems) {
    const kind = historyKind(h);
    const href = h.kind === 'charging'
      ? `/bookings/${h.bookingId}`
      : `/lender/bookings/${h.bookingId}`;

    const counterRole = h.kind === 'charging' ? 'Host' : 'Driver';
    const subtitle = h.counterpartyName
      ? `${counterRole}: ${h.counterpartyName}`
      : `${fmtDate(h.scheduledStart)} · ${fmtTime(h.scheduledStart)}`;

    let amount: number | undefined;
    let amountSign: '+' | '-' | undefined;
    let tag: string | undefined;

    switch (kind) {
      case 'payment':
        if (h.displayAmountPaise !== null) { amount = h.displayAmountPaise; amountSign = '-'; }
        break;
      case 'payout':
        if (h.displayAmountPaise !== null) { amount = h.displayAmountPaise; amountSign = '+'; }
        break;
      case 'session':
        tag = 'In progress';
        break;
      case 'booking':
        if (h.status === 'pending' || h.status === 'awaiting_driver_confirmation') tag = 'Action needed';
        else if (h.status === 'confirmed') tag = 'Confirmed';
        else if (h.status === 'cancelled') tag = 'Cancelled';
        break;
      case 'host':
        if (h.status === 'pending' || h.status === 'awaiting_driver_confirmation') tag = 'Action needed';
        else if (h.status === 'confirmed') tag = 'Confirmed';
        else if (h.status === 'in_progress') tag = 'In progress';
        else if (h.status === 'cancelled') tag = 'Cancelled';
        break;
    }

    items.push({ id: h.id, kind, title: h.chargerTitle, subtitle, amount, amountSign, tag, isoTime: h.scheduledStart, href });
  }

  for (const u of updates) {
    const body = notifBody(u.type, u.data);
    items.push({
      id: u.id,
      kind: 'notice',
      title: NOTIF_LABEL[u.type] ?? u.type.replace(/_/g, ' '),
      subtitle: body,
      isoTime: u.createdAt,
    });
  }

  return items.sort((a, b) => new Date(b.isoTime).getTime() - new Date(a.isoTime).getTime());
}

// ── Icon tiles ────────────────────────────────────────────────────────────────

const KIND_ICON: Record<ActivityKind, { icon: React.ReactNode; bg: string }> = {
  booking: { icon: <CalendarCheck className="size-4" />, bg: 'bg-blue-50 text-blue-600' },
  session: { icon: <Star className="size-4" />,          bg: 'bg-amber-50 text-amber-600' },
  payment: { icon: <CreditCard className="size-4" />,    bg: 'bg-violet-50 text-violet-600' },
  payout:  { icon: <Wallet className="size-4" />,        bg: 'bg-emerald-50 text-emerald-600' },
  host:    { icon: <Home className="size-4" />,          bg: 'bg-green-50 text-green-700' },
  notice:  { icon: <Info className="size-4" />,          bg: 'bg-zinc-100 text-zinc-500' },
};

// ── Filter chips ──────────────────────────────────────────────────────────────

const FILTERS: { label: string; kinds: ActivityKind[] | null }[] = [
  { label: 'All',      kinds: null },
  { label: 'Bookings', kinds: ['booking'] },
  { label: 'Payments', kinds: ['payment', 'payout'] },
  { label: 'Hosting',  kinds: ['host'] },
  { label: 'Notices',  kinds: ['notice', 'session'] },
];

function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 px-3.5 h-8 rounded-full text-xs font-medium border transition-colors active:scale-95',
        active
          ? 'bg-green text-white border-green'
          : 'bg-surface-card text-ink border-border hover:bg-surface-page',
      )}
    >
      {children}
    </button>
  );
}

// ── Feed row ──────────────────────────────────────────────────────────────────

function FeedRow({ item }: { item: FeedItem }) {
  const cfg  = KIND_ICON[item.kind];
  const time = timeAgo(item.isoTime);

  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className={cn('size-10 rounded-2xl grid place-items-center shrink-0', cfg.bg)}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-muted truncate">{item.subtitle}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        {item.amount !== undefined ? (
          <p className={cn('text-sm font-bold', item.amountSign === '+' ? 'text-green-600' : 'text-ink')}>
            {item.amountSign}{fmtAmount(item.amount)}
          </p>
        ) : item.tag ? (
          <span
            className={cn(
              'text-[10px] font-bold rounded-full px-2 py-0.5',
              item.tag === 'Action needed'
                ? 'bg-amber-100 text-amber-700'
                : item.tag === 'Cancelled'
                  ? 'bg-surface-page text-muted'
                  : 'bg-green-soft text-green',
            )}
          >
            {item.tag}
          </span>
        ) : null}
        <p className="text-[10px] text-muted mt-0.5">{time}</p>
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="block active:bg-surface-page transition-colors">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  historyItems:       HistoryItem[];
  updates:            UpdateItem[];
  initialUnreadCount: number;
}

export function ActivityView({ historyItems, updates, initialUnreadCount }: Props) {
  const [filterIdx,   setFilterIdx]   = useState(0);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    if (initialUnreadCount > 0) {
      fetch('/api/activity/mark-updates-read', { method: 'POST' })
        .then(() => setUnreadCount(0))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allItems = useMemo(() => buildFeed(historyItems, updates), [historyItems, updates]);

  const visibleItems = useMemo(() => {
    const { kinds } = FILTERS[filterIdx];
    return kinds ? allItems.filter(i => kinds.includes(i.kind)) : allItems;
  }, [allItems, filterIdx]);

  return (
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">Activity</h1>
            <p className="text-xs text-muted mt-0.5">Bookings, payments and updates — all in one place</p>
          </div>
          <div className="relative size-10 grid place-items-center rounded-full bg-surface-card border border-border shadow-sm">
            <Bell className="size-[18px] text-ink" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2.5 size-2 rounded-full bg-red-500" aria-hidden />
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto phone-scroll px-4 pb-3">
          {FILTERS.map((f, i) => (
            <Chip key={f.label} active={filterIdx === i} onClick={() => setFilterIdx(i)}>
              {f.label}
            </Chip>
          ))}
        </div>

        {/* Feed */}
        <div className="px-4 pb-6">
          {visibleItems.length === 0 ? (
            <div className="rise-in flex flex-col items-center text-center py-14 px-8">
              <div className="size-16 grid place-items-center rounded-3xl bg-green-soft text-green mb-4">
                <Bell className="size-7" />
              </div>
              <p className="font-bold text-ink">Nothing here yet</p>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                Your bookings, receipts and hosting updates will all land in this one feed.
              </p>
            </div>
          ) : (
            <div className="bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden divide-y divide-border">
              {visibleItems.map(item => (
                <FeedRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
