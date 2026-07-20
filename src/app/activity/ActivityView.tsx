'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bell, CalendarCheck, ChevronRight, CreditCard,
  Filter, ArrowUpDown, ChevronDown, Check, Home, Info, MapPin, RotateCw, Star, Wallet, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types (shared with server page) ──────────────────────────────────────────

export type HistoryItem = {
  id: string;
  kind: 'charging' | 'hosting';
  roleInSession: 'driver' | 'host';
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

// ── Kind taxonomy for icon tiles ──────────────────────────────────────────────

type ActivityKind = 'booking' | 'session' | 'payment' | 'payout' | 'host' | 'notice';

const KIND_ICON: Record<ActivityKind, { icon: React.ReactNode; bg: string }> = {
  booking: { icon: <CalendarCheck className="size-4" />, bg: 'bg-blue-50 text-blue-600' },
  session: { icon: <Star className="size-4" />,          bg: 'bg-amber-50 text-amber-600' },
  payment: { icon: <CreditCard className="size-4" />,    bg: 'bg-violet-50 text-violet-600' },
  payout:  { icon: <Wallet className="size-4" />,        bg: 'bg-emerald-50 text-emerald-600' },
  host:    { icon: <Home className="size-4" />,          bg: 'bg-green-50 text-green-700' },
  notice:  { icon: <Info className="size-4" />,          bg: 'bg-zinc-100 text-zinc-500' },
};

function historyItemKind(item: HistoryItem): ActivityKind {
  if (item.kind === 'charging') {
    if (item.status === 'completed')   return 'payment';
    if (item.status === 'in_progress') return 'session';
    return 'booking';
  }
  // hosting
  if (item.status === 'completed') return 'payout';
  return 'host';
}

function notifItemKind(type: string): ActivityKind {
  if (type === 'payout_processed')  return 'payout';
  if (type.startsWith('booking_'))  return 'booking';
  if (type.startsWith('session_'))  return 'session';
  return 'notice';
}

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

function driverAmountDisplay(item: HistoryItem): string | null {
  if (item.status === 'cancelled' || item.status === 'auto_reject') return null;
  if (item.displayAmountPaise !== null && item.displayAmountPaise >= 0) {
    return `Paid ₹${(item.displayAmountPaise / 100).toFixed(2)}`;
  }
  return null;
}

function hostAmountDisplay(item: HistoryItem): string | null {
  if (item.status !== 'completed') return null;
  if (item.displayAmountPaise !== null && item.displayAmountPaise >= 0) {
    return `Earned ₹${(item.displayAmountPaise / 100).toFixed(2)}`;
  }
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
  // GreenPath route green pin (#159a4c); privacy fuzz preserved
  const marker = `pin-s+159a4c(${fLng.toFixed(5)},${fLat.toFixed(5)})`;
  const center = `${fLng.toFixed(5)},${fLat.toFixed(5)},12`;
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${marker}/${center}/480x200@2x?access_token=${token}`;
}

// CSS filter that shifts Mapbox light-v11's warm-beige palette toward
// GreenPath's green-tinted palette (land #eef3ea, water #cfe4f4)
const MAP_FILTER = 'hue-rotate(55deg) saturate(0.75) brightness(1.01)';

// ── Eyebrow label — tense + role aware ───────────────────────────────────────

function sessionEyebrow(item: HistoryItem): string {
  const { status, roleInSession } = item;
  if (['pending', 'confirmed', 'awaiting_driver_confirmation'].includes(status)) {
    return roleInSession === 'driver' ? 'UPCOMING CHARGE' : 'UPCOMING GUEST';
  }
  if (status === 'in_progress' || status === 'awaiting_end_confirmation') {
    return roleInSession === 'driver' ? "YOU'RE CHARGING" : "YOU'RE HOSTING";
  }
  if (status === 'completed') {
    return roleInSession === 'driver' ? 'YOU CHARGED' : 'YOU HOSTED';
  }
  return roleInSession === 'driver' ? 'CHARGE CANCELLED' : 'HOSTING CANCELLED';
}

// ── Status display ────────────────────────────────────────────────────────────

const DRIVER_STATUS_LABEL: Record<string, string> = {
  pending:                      'Awaiting confirmation',
  confirmed:                    'Confirmed',
  awaiting_driver_confirmation: 'Ready to start',
  in_progress:                  'Charging in progress',
  awaiting_end_confirmation:    'Ready to end',
  completed:                    'Completed',
  cancelled:                    'Cancelled',
  no_show:                      'No show',
  auto_reject:                  'Not accepted',
};

const HOST_STATUS_LABEL: Record<string, string> = {
  pending:                      'Awaiting your approval',
  confirmed:                    'Booking confirmed',
  awaiting_driver_confirmation: 'Waiting for driver',
  in_progress:                  'Guest charging',
  awaiting_end_confirmation:    'Waiting to end session',
  completed:                    'Completed',
  cancelled:                    'Cancelled',
  no_show:                      "Driver didn't arrive",
  auto_reject:                  'Auto-rejected',
};

// GreenPath pill colors: amber for action-needed, green-soft for neutral, danger for cancelled
const STATUS_COLOR: Record<string, string> = {
  pending:                      'bg-amber-100 text-amber-700',
  confirmed:                    'bg-green-soft text-green',
  awaiting_driver_confirmation: 'bg-amber-100 text-amber-700',
  in_progress:                  'bg-green-soft text-green',
  awaiting_end_confirmation:    'bg-amber-100 text-amber-700',
  completed:                    'bg-surface-page text-muted',
  cancelled:                    'bg-danger-soft text-danger',
  no_show:                      'bg-danger-soft text-danger',
  auto_reject:                  'bg-surface-page text-muted',
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

// ── Empty state (GreenPath centered pattern) ──────────────────────────────────

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="rise-in flex flex-col items-center text-center py-14 px-8">
      <div className="size-16 grid place-items-center rounded-3xl bg-green-soft text-green mb-4">
        {icon}
      </div>
      <p className="font-bold text-ink">{title}</p>
      <p className="text-sm text-muted mt-1 leading-relaxed">{subtitle}</p>
    </div>
  );
}

// ── Filter button — GreenPath Chip style ──────────────────────────────────────

function FilterButton({ filter, onClick }: { filter: FilterType; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-medium border transition-colors active:scale-95',
        filter !== 'all'
          ? 'bg-green text-white border-green'
          : 'bg-surface-card text-ink border-border hover:bg-surface-page',
      )}
    >
      <Filter className="w-3 h-3 shrink-0" />
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
            className="p-1.5 rounded-full hover:bg-surface-page transition-colors"
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

// ── Sort button — GreenPath Chip style ────────────────────────────────────────

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
          'flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap active:scale-95',
          open ? 'bg-green text-white border-green' : 'bg-surface-card text-ink border-border hover:bg-surface-page',
        )}
      >
        <ArrowUpDown className="w-3 h-3 shrink-0" />
        {SORT_LABELS[sort]}
        <ChevronDown className={cn('w-3 h-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface-card border border-border rounded-xl py-1 z-20 min-w-[130px] shadow-md">
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

// ── Shared map thumbnail ──────────────────────────────────────────────────────

function SessionMapThumbnail({
  item, href, onError,
}: {
  item: HistoryItem;
  href: string;
  onError: () => void;
}) {
  const mapSrc = item.chargerLat !== null && item.chargerLng !== null
    ? staticMapUrl(item.chargerLat, item.chargerLng, item.bookingId)
    : null;

  return (
    <Link href={href} className="block h-36 bg-surface-page overflow-hidden">
      {mapSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mapSrc}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: MAP_FILTER }}
          onError={onError}
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
  );
}

// ── Driver featured card ──────────────────────────────────────────────────────

function DriverFeaturedCard({ item }: { item: HistoryItem }) {
  const [mapImgError, setMapImgError] = useState(false);
  const detailHref  = `/bookings/${item.bookingId}`;
  const statusLabel = DRIVER_STATUS_LABEL[item.status] ?? item.status;
  const statusColor = STATUS_COLOR[item.status] ?? 'bg-surface-page text-muted';
  const amountText  = driverAmountDisplay(item);
  const showRate    = item.status === 'completed' && !item.hasRated;

  const isUpcoming     = ['pending', 'confirmed'].includes(item.status);
  const isReadyToStart = item.status === 'awaiting_driver_confirmation';
  const isInProgress   = item.status === 'in_progress' || item.status === 'awaiting_end_confirmation';
  const isCompleted    = item.status === 'completed';
  const isTerminal     = ['cancelled', 'no_show', 'auto_reject'].includes(item.status);

  const mapsUrl = item.chargerLat !== null && item.chargerLng !== null
    ? `https://www.google.com/maps/dir/?api=1&destination=${item.chargerLat},${item.chargerLng}`
    : null;

  const secondaryCtaLabel =
    isReadyToStart ? 'Start session' :
    isInProgress   ? 'View session'  :
    isTerminal     ? 'View details'  : null;

  const ctaBtnClass = 'flex items-center justify-center h-11 w-full rounded-xl border border-border text-sm font-semibold text-ink bg-surface-card hover:bg-surface-page transition-colors';

  return (
    <div className="bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden">
      {!mapImgError && (
        <SessionMapThumbnail item={item} href={detailHref} onError={() => setMapImgError(true)} />
      )}
      {mapImgError && (
        <Link href={detailHref} className="block h-36 bg-surface-page overflow-hidden">
          {item.chargerPhoto
            ? <img src={item.chargerPhoto} alt="" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
            : <div className="w-full h-full flex items-center justify-center"><MapPin className="w-8 h-8 text-muted/40" aria-hidden /></div>
          }
        </Link>
      )}

      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-muted">{sessionEyebrow(item)}</p>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusColor)}>
            {statusLabel}
          </span>
        </div>

        <Link href={detailHref} className="block">
          <p className="text-base font-semibold text-ink leading-snug">{item.chargerTitle}</p>
        </Link>

        {item.counterpartyName && (
          <p className="text-xs text-muted mt-0.5">Hosted by {item.counterpartyName}</p>
        )}

        <p className="text-xs text-muted mt-1">
          {fmtDate(item.scheduledStart)} at {fmtTime(item.scheduledStart)}
        </p>

        {amountText && (
          <p className="text-sm font-bold mt-1 text-ink">{amountText}</p>
        )}

        <div className="space-y-2 mt-3.5">
          {isCompleted ? (
            <div className="flex items-center gap-2">
              {showRate && (
                <Link href={detailHref} className="flex-1 flex items-center justify-center h-11 rounded-xl border border-border text-sm font-semibold text-ink bg-surface-card hover:bg-surface-page transition-colors">
                  Rate session
                </Link>
              )}
              <Link
                href={`/explore/${item.chargerId}`}
                className={cn(
                  'flex items-center justify-center gap-1.5 h-11 rounded-xl text-sm font-semibold bg-green text-white hover:bg-green-deep transition-colors',
                  showRate ? 'flex-1' : 'w-full',
                )}
              >
                <RotateCw className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Book again
              </Link>
            </div>
          ) : isUpcoming ? (
            mapsUrl
              ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={ctaBtnClass}>Get directions</a>
              : <Link href={detailHref} className={ctaBtnClass}>View booking</Link>
          ) : secondaryCtaLabel ? (
            <Link href={detailHref} className={ctaBtnClass}>{secondaryCtaLabel}</Link>
          ) : null}
          {!isTerminal && (
            <Link
              href={detailHref}
              className="flex items-center justify-center gap-1 py-0.5 w-full text-sm font-semibold text-muted hover:text-ink transition-colors"
            >
              View booking
              <ChevronRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Host featured card ────────────────────────────────────────────────────────

function HostFeaturedCard({ item }: { item: HistoryItem }) {
  const [mapImgError, setMapImgError] = useState(false);
  const detailHref  = `/lender/bookings/${item.bookingId}`;
  const statusLabel = HOST_STATUS_LABEL[item.status] ?? item.status;
  const statusColor = STATUS_COLOR[item.status] ?? 'bg-surface-page text-muted';
  const amountText  = hostAmountDisplay(item);

  return (
    <div className="bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden">
      {!mapImgError && (
        <SessionMapThumbnail item={item} href={detailHref} onError={() => setMapImgError(true)} />
      )}
      {mapImgError && (
        <Link href={detailHref} className="block h-36 bg-surface-page overflow-hidden">
          {item.chargerPhoto
            ? <img src={item.chargerPhoto} alt="" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
            : <div className="w-full h-full flex items-center justify-center"><MapPin className="w-8 h-8 text-muted/40" aria-hidden /></div>
          }
        </Link>
      )}

      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-muted">{sessionEyebrow(item)}</p>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusColor)}>
            {statusLabel}
          </span>
        </div>

        <Link href={detailHref} className="block">
          <p className="text-base font-semibold text-ink leading-snug">{item.chargerTitle}</p>
        </Link>

        {item.counterpartyName && (
          <p className="text-xs text-muted mt-0.5">Guest: {item.counterpartyName}</p>
        )}

        <p className="text-xs text-muted mt-1">
          {fmtDate(item.scheduledStart)} at {fmtTime(item.scheduledStart)}
        </p>

        {amountText && (
          <p className="text-sm font-bold mt-1 text-green">{amountText}</p>
        )}

        <div className="mt-3.5">
          <Link
            href={detailHref}
            className="flex items-center justify-center gap-1 h-9 w-full rounded-xl border border-border text-sm font-semibold text-ink bg-surface-card hover:bg-surface-page transition-colors"
          >
            View booking
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Compact session rows ──────────────────────────────────────────────────────

function DriverCompactRow({ item }: { item: HistoryItem }) {
  const detailHref  = `/bookings/${item.bookingId}`;
  const statusLabel = DRIVER_STATUS_LABEL[item.status] ?? item.status;
  const statusColor = STATUS_COLOR[item.status] ?? 'bg-surface-page text-muted';
  const amountText  = driverAmountDisplay(item);
  const kind        = historyItemKind(item);
  const cfg         = KIND_ICON[kind];
  const showBookAgain = item.status === 'completed';

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Link href={detailHref} className="shrink-0">
        <div className={cn('size-10 rounded-2xl grid place-items-center', cfg.bg)}>
          {cfg.icon}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-muted leading-none mb-0.5">
          {sessionEyebrow(item)}
        </p>
        <Link href={detailHref}>
          <p className="text-sm font-semibold text-ink truncate">{item.chargerTitle}</p>
        </Link>
        <p className="text-xs text-muted truncate">
          {item.counterpartyName
            ? `Hosted by ${item.counterpartyName} · ${fmtDate(item.scheduledStart)}`
            : fmtDate(item.scheduledStart)}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {amountText ? (
          <p className="text-xs font-semibold text-ink">{amountText}</p>
        ) : (
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', statusColor)}>
            {statusLabel}
          </span>
        )}
        {showBookAgain ? (
          <Link
            href={`/explore/${item.chargerId}`}
            className="flex items-center gap-1 px-2.5 min-h-[44px] rounded-lg border border-green/25 bg-green-soft text-green text-[11px] font-semibold whitespace-nowrap transition-colors hover:bg-green-soft/80"
          >
            <RotateCw className="w-3 h-3 shrink-0" aria-hidden />
            Book again
          </Link>
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted mt-0.5" aria-hidden />
        )}
      </div>
    </div>
  );
}

function HostCompactRow({ item }: { item: HistoryItem }) {
  const detailHref  = `/lender/bookings/${item.bookingId}`;
  const statusLabel = HOST_STATUS_LABEL[item.status] ?? item.status;
  const statusColor = STATUS_COLOR[item.status] ?? 'bg-surface-page text-muted';
  const amountText  = hostAmountDisplay(item);
  const kind        = historyItemKind(item);
  const cfg         = KIND_ICON[kind];

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Link href={detailHref} className="shrink-0">
        <div className={cn('size-10 rounded-2xl grid place-items-center', cfg.bg)}>
          {cfg.icon}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-muted leading-none mb-0.5">
          {sessionEyebrow(item)}
        </p>
        <Link href={detailHref}>
          <p className="text-sm font-semibold text-ink truncate">{item.chargerTitle}</p>
        </Link>
        <p className="text-xs text-muted truncate">
          {item.counterpartyName
            ? `Guest: ${item.counterpartyName} · ${fmtDate(item.scheduledStart)}`
            : fmtDate(item.scheduledStart)}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {amountText ? (
          <p className="text-xs font-semibold text-green">{amountText}</p>
        ) : (
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', statusColor)}>
            {statusLabel}
          </span>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-muted mt-0.5" aria-hidden />
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

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-ink">Activity</h1>
          <p className="text-xs text-muted mt-0.5">Your charging sessions and hosting history in one place</p>
        </div>

        {/* Sessions / Updates tabs — GreenPath pill chip style */}
        <div className="flex gap-2 mb-6">
          {(['sessions', 'updates'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 h-9 rounded-full text-sm font-semibold border transition-colors',
                tab === t
                  ? 'bg-green text-white border-green'
                  : 'bg-surface-card text-ink border-border hover:bg-surface-page',
              )}
            >
              {t === 'sessions' ? 'Sessions' : 'Updates'}
              {t === 'updates' && unreadCount > 0 && (
                <span className={cn(
                  'min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full leading-[18px] text-center',
                  tab === t ? 'bg-white/25 text-white' : 'bg-copper text-white',
                )}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Sessions ── */}
        {tab === 'sessions' && (
          <div>
            {/* Filter + Sort bar */}
            <div className="flex items-center gap-2 mb-4">
              <FilterButton filter={filter} onClick={() => setFilterSheetOpen(true)} />
              <SortButton sort={sortDir} onChange={setSortDir} />
            </div>

            {sorted.length === 0 ? (
              <EmptyState
                icon={<Bell className="size-7" />}
                title={filter === 'all' ? 'No activity yet' : 'Nothing here'}
                subtitle={
                  filter === 'all'
                    ? 'Your charging sessions and hosting history will appear here'
                    : `No ${FILTER_LABELS[filter].toLowerCase()} sessions found`
                }
              />
            ) : (
              <div className="space-y-5 pb-6">
                {/* Featured card — most recent session in current filter */}
                {featured && (
                  featured.roleInSession === 'driver'
                    ? <DriverFeaturedCard item={featured} />
                    : <HostFeaturedCard item={featured} />
                )}

                {/* Compact list — single rounded-3xl card, date groups as section headers inside */}
                {grouped.length > 0 && (
                  <div className="bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden">
                    {grouped.map(({ label, items }, gi) => (
                      <div key={label}>
                        <div className={cn(
                          'px-4 py-2 bg-surface-page',
                          gi > 0 && 'border-t border-border',
                        )}>
                          <p className="text-[10px] font-semibold text-muted tracking-wider uppercase">
                            {label}
                          </p>
                        </div>
                        <div className="divide-y divide-border">
                          {items.map(item => (
                            item.roleInSession === 'driver'
                              ? <DriverCompactRow key={item.id} item={item} />
                              : <HostCompactRow key={item.id} item={item} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
              <EmptyState
                icon={<Bell className="size-7" />}
                title="No updates yet"
                subtitle="Booking confirmations, session events, and account updates will appear here"
              />
            ) : (
              <div className="bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden divide-y divide-border mb-6">
                {updates.map(u => {
                  const kind = notifItemKind(u.type);
                  const cfg  = KIND_ICON[kind];
                  const body = notifBody(u.type, u.data);
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3.5">
                      {/* Kind-coded icon tile with unread dot */}
                      <div className={cn('relative size-10 rounded-2xl grid place-items-center shrink-0', cfg.bg)}>
                        {cfg.icon}
                        {!u.read && (
                          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-green" aria-hidden />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm text-ink truncate', u.read ? 'font-medium' : 'font-semibold')}>
                          {NOTIF_LABEL[u.type] ?? u.type.replace(/_/g, ' ')}
                        </p>
                        {body && (
                          <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">{body}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-muted whitespace-nowrap">
                        {timeAgo(u.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
