'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronRight, Filter, ArrowUpDown, ChevronDown, Check, X, MapPin, Zap } from 'lucide-react';
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

type TabType    = 'sessions' | 'updates';
type FilterType = 'all' | 'upcoming' | 'completed' | 'cancelled';
type SortDir    = 'newest' | 'oldest';

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

function fmtPrice(amountPaise: number | null, status: string): string | null {
  if (status === 'cancelled') return '₹0.00';
  if (amountPaise !== null && amountPaise >= 0) return `₹${(amountPaise / 100).toFixed(2)}`;
  return null;
}

// Deterministic fuzz based on booking ID — stable per booking, ~350 m offset
function fuzzCoords(lat: number, lng: number, seed: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  }
  const dLat = (((h & 0xff) - 127) / 127) * 0.003;
  const dLng = ((((h >> 8) & 0xff) - 127) / 127) * 0.003;
  return { lat: lat + dLat, lng: lng + dLng };
}

function staticMapUrl(lat: number, lng: number, seed: string): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return '';
  const { lat: fLat, lng: fLng } = fuzzCoords(lat, lng, seed);
  // pin-s (plain coloured pin — no Maki icon name to avoid 422 errors)
  const marker = `pin-s+1c6b47(${fLng.toFixed(5)},${fLat.toFixed(5)})`;
  const center = `${fLng.toFixed(5)},${fLat.toFixed(5)},12`;
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${marker}/${center}/480x200@2x?access_token=${token}`;
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

// ── Filter helpers ────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<FilterType, string> = {
  all:       'All',
  upcoming:  'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const SORT_LABELS: Record<SortDir, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
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

function applySortDir(items: HistoryItem[], dir: SortDir): HistoryItem[] {
  return [...items].sort((a, b) => {
    const diff = new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime();
    return dir === 'newest' ? diff : -diff;
  });
}

// ── Grouping (applied to compact list only) ───────────────────────────────────

type DateGroup = { label: string; items: HistoryItem[] };

function groupByDate(items: HistoryItem[]): DateGroup[] {
  const todayStart     = new Date(); todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart  = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const buckets: Record<'upcoming' | 'today' | 'yesterday' | 'earlier', HistoryItem[]> = {
    upcoming: [], today: [], yesterday: [], earlier: [],
  };

  for (const item of items) {
    const d = new Date(item.scheduledStart);
    if      (d >= tomorrowStart)  buckets.upcoming.push(item);
    else if (d >= todayStart)     buckets.today.push(item);
    else if (d >= yesterdayStart) buckets.yesterday.push(item);
    else                          buckets.earlier.push(item);
  }

  buckets.upcoming.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  return (
    [
      { label: 'Upcoming',  items: buckets.upcoming   },
      { label: 'Today',     items: buckets.today      },
      { label: 'Yesterday', items: buckets.yesterday  },
      { label: 'Earlier',   items: buckets.earlier    },
    ] satisfies DateGroup[]
  ).filter(g => g.items.length > 0);
}

// ── Filter button ─────────────────────────────────────────────────────────────

function FilterButton({ filter, onClick }: { filter: FilterType; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center gap-2 h-9 px-3 rounded-token text-xs font-semibold text-ink bg-surface-card',
        'border transition-colors',
        filter !== 'all' ? 'border-ink' : 'border-border',
      )}
    >
      <Filter className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 text-left">{FILTER_LABELS[filter]}</span>
      <ChevronDown className="w-3 h-3 shrink-0" />
    </button>
  );
}

// ── Filter bottom sheet ───────────────────────────────────────────────────────

function SessionFilterSheet({
  isOpen, items, filter, onSelect, onClose,
}: {
  isOpen: boolean;
  items: HistoryItem[];
  filter: FilterType;
  onSelect: (f: FilterType) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const now = new Date().toISOString();
  const counts: Record<FilterType, number> = {
    all: items.length,
    upcoming: items.filter(i =>
      i.status === 'in_progress' ||
      (['confirmed', 'pending', 'awaiting_driver_confirmation'].includes(i.status) && i.scheduledStart > now)
    ).length,
    completed: items.filter(i => i.status === 'completed').length,
    cancelled: items.filter(i => i.status === 'cancelled').length,
  };

  const options: { key: FilterType; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'upcoming',  label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-40 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 bg-surface-card rounded-t-2xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Filter sessions"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center px-4 pb-3 pt-1">
          <h2 className="font-semibold text-ink text-base flex-1">Filter sessions</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-token hover:bg-surface-page transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>
        <div className="pb-8">
          {options.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { onSelect(key); onClose(); }}
              className="w-full flex items-center px-4 py-3.5 text-sm font-semibold text-ink hover:bg-surface-page transition-colors"
            >
              <span className="flex-1 text-left">{label}</span>
              <span className="text-muted text-xs font-normal mr-3">{counts[key]}</span>
              <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                {filter === key && <Check className="w-4 h-4 text-ink" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Sort button ───────────────────────────────────────────────────────────────

function SortButton({ sort, onChange }: { sort: SortDir; onChange: (s: SortDir) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 h-9 px-3 rounded-token text-xs font-semibold text-ink bg-surface-card',
          'border transition-colors whitespace-nowrap',
          open ? 'border-ink' : 'border-border',
        )}
      >
        <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
        {SORT_LABELS[sort]}
        <ChevronDown className={cn('w-3 h-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface-card border border-border rounded-token-lg py-1 z-20 min-w-[130px] shadow-md">
          {(['newest', 'oldest'] as SortDir[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => { onChange(key); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-ink hover:bg-surface-page transition-colors"
            >
              <span className="flex-1 text-left">{SORT_LABELS[key]}</span>
              {sort === key && <Check className="w-3.5 h-3.5 text-ink shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Featured session card ─────────────────────────────────────────────────────

function FeaturedSessionCard({ item }: { item: HistoryItem }) {
  const [mapImgError, setMapImgError] = useState(false);

  const detailHref  = item.kind === 'charging'
    ? `/bookings/${item.bookingId}`
    : `/lender/bookings/${item.bookingId}`;
  const statusLabel = STATUS_LABEL[item.status];
  const statusColor = STATUS_COLOR[item.status] ?? 'text-muted bg-surface-page';
  const price       = fmtPrice(item.displayAmountPaise, item.status);
  const showRate    = item.kind === 'charging' && item.status === 'completed' && !item.hasRated;

  // Only attempt the static map when we have coords and it hasn't already errored
  const mapSrc = !mapImgError && item.chargerLat !== null && item.chargerLng !== null
    ? staticMapUrl(item.chargerLat, item.chargerLng, item.bookingId)
    : null;

  return (
    <div className="bg-surface-card border border-border rounded-token-lg overflow-hidden">
      {/* Map thumbnail — approximate location, fuzzed ~300 m from exact address */}
      <Link href={detailHref} className="block h-36 bg-surface-page overflow-hidden">
        {mapSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapSrc}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setMapImgError(true)}
          />
        ) : item.chargerPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.chargerPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="w-8 h-8 text-muted/40" aria-hidden />
          </div>
        )}
      </Link>

      {/* Details */}
      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-muted">
            {item.kind === 'charging' ? 'Charging' : 'Hosting'}
          </p>
          {statusLabel && (
            <span className={cn('text-[10.5px] font-semibold px-2 py-0.5 rounded-token', statusColor)}>
              {statusLabel}
            </span>
          )}
        </div>

        <Link href={detailHref} className="block">
          <p className="text-base font-semibold text-ink leading-snug">{item.chargerTitle}</p>
        </Link>

        {item.counterpartyName && (
          <p className="text-xs text-muted mt-0.5">
            {item.kind === 'charging' ? 'Host' : 'Driver'}: {item.counterpartyName}
          </p>
        )}

        <p className="text-xs text-muted mt-1">
          {fmtDate(item.scheduledStart)} at {fmtTime(item.scheduledStart)}
        </p>

        {price && (
          <p className="text-sm font-semibold text-ink mt-1">{price}</p>
        )}

        {/* Actions — Book again always present; Rate when applicable; View booking always secondary */}
        <div className="space-y-2 mt-3.5">
          <div className="flex items-center gap-2">
            {showRate && (
              <Link
                href={detailHref}
                className="flex-1 flex items-center justify-center h-9 rounded-token border border-border text-sm font-semibold text-ink bg-surface-card hover:bg-surface-page transition-colors"
              >
                Rate session
              </Link>
            )}
            <Link
              href={`/explore/${item.chargerId}`}
              className={cn(
                'flex items-center justify-center h-9 rounded-token text-sm font-semibold bg-ink text-white hover:bg-ink/90 transition-colors',
                showRate ? 'flex-1' : 'w-full',
              )}
            >
              Book again
            </Link>
          </div>
          <Link
            href={detailHref}
            className="flex items-center justify-center gap-1 py-0.5 w-full text-sm font-semibold text-muted hover:text-ink transition-colors"
          >
            View booking
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Compact session row ───────────────────────────────────────────────────────

function CompactSessionRow({ item }: { item: HistoryItem }) {
  const detailHref = item.kind === 'charging'
    ? `/bookings/${item.bookingId}`
    : `/lender/bookings/${item.bookingId}`;
  const statusLabel = STATUS_LABEL[item.status];
  const statusColor = STATUS_COLOR[item.status] ?? 'text-muted bg-surface-page';
  const price       = fmtPrice(item.displayAmountPaise, item.status);
  const showBookAgain = item.kind === 'charging' && item.status === 'completed';

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      {/* Thumbnail — charger photo for compact rows */}
      <Link href={detailHref} className="shrink-0 w-14 h-14 rounded-token bg-surface-page overflow-hidden border border-border">
        {item.chargerPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.chargerPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Zap className="w-5 h-5 text-muted/50" aria-hidden />
          </div>
        )}
      </Link>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-muted leading-tight">
          {item.kind === 'charging' ? 'Charging' : 'Hosting'}
        </p>
        <Link href={detailHref}>
          <p className="text-sm font-semibold text-ink truncate">{item.chargerTitle}</p>
        </Link>
        {item.counterpartyName && (
          <p className="text-xs text-muted truncate">
            {item.kind === 'charging' ? 'Host' : 'Driver'}: {item.counterpartyName}
          </p>
        )}
        <p className="text-xs text-muted">
          {fmtDate(item.scheduledStart)} · {fmtTime(item.scheduledStart)}
        </p>
      </div>

      {/* Right: price + status + action */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {price && <p className="text-sm font-semibold text-ink">{price}</p>}
        {statusLabel && (
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-token', statusColor)}>
            {statusLabel}
          </span>
        )}
        {showBookAgain ? (
          <Link
            href={`/explore/${item.chargerId}`}
            className="text-[11px] font-semibold text-green hover:text-green-deep transition-colors whitespace-nowrap"
          >
            Book again
          </Link>
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted mt-0.5" aria-hidden />
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  historyItems:       HistoryItem[];
  updates:            UpdateItem[];
  initialUnreadCount: number;
}

export function ActivityView({ historyItems, updates, initialUnreadCount }: Props) {
  const [tab,             setTab]             = useState<TabType>('sessions');
  const [filter,          setFilter]          = useState<FilterType>('all');
  const [sortDir,         setSortDir]         = useState<SortDir>('newest');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [unreadCount,     setUnreadCount]     = useState(initialUnreadCount);
  const [markedRead,      setMarkedRead]      = useState(false);

  useEffect(() => {
    if (tab === 'updates' && !markedRead && unreadCount > 0) {
      setMarkedRead(true);
      fetch('/api/activity/mark-updates-read', { method: 'POST' })
        .then(() => setUnreadCount(0))
        .catch(() => {});
    }
  }, [tab, markedRead, unreadCount]);

  const filtered = applyFilter(historyItems, filter);
  const sorted   = applySortDir(filtered, sortDir);
  const featured = sorted[0] ?? null;
  const rest     = sorted.slice(1);
  const grouped  = groupByDate(rest);

  return (
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-6">

        <h1 className="text-2xl font-medium text-ink mb-5">Activity</h1>

        {/* Segmented tab control */}
        <div className="flex bg-surface-page border border-border rounded-token-lg p-1 gap-1 mb-6">
          {(['sessions', 'updates'] as const).map(t => (
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
              {t === 'sessions' ? 'Sessions' : 'Updates'}
              {t === 'updates' && unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-copper text-white rounded-pill leading-[18px] text-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Sessions ── */}
        {tab === 'sessions' && (
          <div>
            {/* Filter + Sort bar — mirrors My Chargers Hosting Workspace pattern */}
            <div className="flex items-center gap-2 mb-4">
              <FilterButton filter={filter} onClick={() => setFilterSheetOpen(true)} />
              <SortButton sort={sortDir} onChange={setSortDir} />
            </div>

            {sorted.length === 0 ? (
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
                      No {FILTER_LABELS[filter].toLowerCase()} sessions found
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-5 pb-6">
                {/* Featured card — most recent session in current filter */}
                {featured && <FeaturedSessionCard item={featured} />}

                {/* Compact list — remaining sessions, date-grouped */}
                {grouped.map(({ label, items }) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-muted tracking-wider uppercase mb-2 px-0.5">
                      {label}
                    </p>
                    <div className="bg-surface-card border border-border rounded-token-lg overflow-hidden divide-y divide-border">
                      {items.map(item => (
                        <CompactSessionRow key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <SessionFilterSheet
              isOpen={filterSheetOpen}
              items={historyItems}
              filter={filter}
              onSelect={setFilter}
              onClose={() => setFilterSheetOpen(false)}
            />
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
                  <div key={u.id} className="flex items-start gap-3 px-4 py-3.5">
                    <span
                      className={cn(
                        'mt-[5px] w-1.5 h-1.5 rounded-full shrink-0',
                        u.read ? 'opacity-0' : 'bg-green',
                      )}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm text-ink', u.read ? 'font-medium' : 'font-semibold')}>
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
