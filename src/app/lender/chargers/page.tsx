'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Zap, Star, ArrowUpDown, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';
import { ImageCarousel } from '@/components/chargers/ImageCarousel';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChargerStatus = 'draft' | 'active' | 'paused' | 'suspended';

type Charger = {
  id: string;
  title: string;
  address: string;
  price_per_kwh: number;
  status: ChargerStatus;
  total_sessions: number;
  charger_type: string;
  connector_types: string[];
  photos: string[];
  avg_rating: number | null;
  created_at: string;
};

type SortKey = 'last_active' | 'most_bookings' | 'highest_rated' | 'date_added';
type FilterKey = 'all' | 'active' | 'paused' | 'draft' | 'suspended';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortChargers(chargers: Charger[], sort: SortKey): Charger[] {
  const arr = [...chargers];
  switch (sort) {
    case 'most_bookings':
      return arr.sort((a, b) => b.total_sessions - a.total_sessions);
    case 'highest_rated':
      return arr.sort((a, b) => {
        if (a.avg_rating === null && b.avg_rating === null) return 0;
        if (a.avg_rating === null) return 1;
        if (b.avg_rating === null) return -1;
        return b.avg_rating - a.avg_rating;
      });
    case 'date_added':
      return arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    default: // last_active → most recent first
      return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

// ─── Tile status badge ────────────────────────────────────────────────────────

function TileStatusBadge({ status, inUse }: { status: ChargerStatus; inUse: boolean }) {
  const { label, className } = (() => {
    if (status === 'active' && inUse) {
      return { label: 'Live · In use', className: 'bg-amber-500/90 text-white' };
    }
    if (status === 'active') {
      return { label: 'Live · Available', className: 'bg-[#10d96a]/90 text-[#0a5c2e]' };
    }
    if (status === 'paused') {
      return { label: 'Paused', className: 'bg-gray-800/70 text-white' };
    }
    if (status === 'draft') {
      return { label: 'Pending verification', className: 'bg-blue-500/90 text-white' };
    }
    return { label: 'Suspended', className: 'bg-red-600/90 text-white' };
  })();

  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap backdrop-blur-sm', className)}>
      {label}
    </span>
  );
}

// ─── Charger tile ─────────────────────────────────────────────────────────────

function ChargerTile({
  charger,
  inUse,
}: {
  charger: Charger;
  inUse: boolean;
}) {
  const router = useRouter();
  const isSuspended = charger.status === 'suspended';

  return (
    <div
      className={cn(
        'bg-white rounded-xl overflow-hidden border border-gray-100 cursor-pointer',
        'transition-shadow hover:shadow-md active:shadow-none',
        isSuspended && 'opacity-70',
      )}
      onClick={() => router.push(`/lender/chargers/${charger.id}`)}
    >
      {/* Image area */}
      <div className="relative">
        <ImageCarousel
          photos={charger.photos}
          alt={charger.title}
          useIntersectionObserver
          autoRotate
        />
        {/* Status badge overlay */}
        <div className="absolute top-2 right-2">
          <TileStatusBadge status={charger.status} inUse={inUse} />
        </div>
      </div>

      {/* Info section */}
      <div className="p-3">
        <p className="font-medium text-sm text-ink leading-snug">{charger.title}</p>
        <p className="text-xs text-muted truncate mt-0.5">{charger.address}</p>

        <div className="flex items-center gap-2 mt-2 text-xs text-muted">
          {charger.avg_rating !== null && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-ink">{charger.avg_rating.toFixed(1)}</span>
            </span>
          )}
          {charger.avg_rating !== null && <span>·</span>}
          <span>{charger.total_sessions} booking{charger.total_sessions !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
  active: 'Live',
  paused: 'Paused',
  draft: 'Draft',
  suspended: 'Suspended',
};

function FilterChips({
  chargers,
  activeFilters,
  onChange,
}: {
  chargers: Charger[];
  activeFilters: Set<FilterKey>;
  onChange: (next: Set<FilterKey>) => void;
}) {
  const counts: Record<FilterKey, number> = {
    all: chargers.length,
    active: chargers.filter(c => c.status === 'active').length,
    paused: chargers.filter(c => c.status === 'paused').length,
    draft: chargers.filter(c => c.status === 'draft').length,
    suspended: chargers.filter(c => c.status === 'suspended').length,
  };

  function toggle(key: FilterKey) {
    if (key === 'all') {
      onChange(new Set(['all']));
      return;
    }
    const next = new Set(activeFilters);
    next.delete('all');
    if (next.has(key)) {
      next.delete(key);
      if (next.size === 0) next.add('all');
    } else {
      next.add(key);
    }
    onChange(next);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      {(['all', 'active', 'paused', 'draft', 'suspended'] as FilterKey[]).map(key => {
        const active = activeFilters.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0',
              active
                ? 'bg-ink text-white'
                : 'bg-gray-100 text-muted hover:bg-gray-200',
            )}
          >
            {FILTER_LABELS[key]} ({counts[key]})
          </button>
        );
      })}
    </div>
  );
}

// ─── Sort button ──────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortKey, string> = {
  last_active: 'Last active',
  most_bookings: 'Most bookings',
  highest_rated: 'Highest rated',
  date_added: 'Date added',
};

function SortButton({ sort, onChange }: { sort: SortKey; onChange: (s: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white',
          'border transition-colors whitespace-nowrap',
          open ? 'border-ink text-ink' : 'border-gray-300 text-ink',
        )}
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        {SORT_LABELS[sort]}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-md py-1 z-20 min-w-[148px]">
          {(['last_active', 'most_bookings', 'highest_rated', 'date_added'] as SortKey[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => { onChange(key); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2 text-xs font-semibold transition-colors',
                sort === key ? 'text-ink bg-gray-50' : 'text-muted hover:bg-gray-50',
              )}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function LenderChargersContent() {
  const { profile, loading: profileLoading } = useProfile();

  const [chargers, setChargers] = useState<Charger[]>([]);
  const [inProgressIds, setInProgressIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('last_active');
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set(['all']));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chargersRes, bookingsRes] = await Promise.all([
        fetch('/api/lender/chargers'),
        fetch('/api/lender/bookings?filter=active'),
      ]);

      if (!chargersRes.ok) { setError('Failed to load chargers'); return; }
      const { data: chargerData } = await chargersRes.json() as { data: Charger[] };
      setChargers(chargerData ?? []);

      if (bookingsRes.ok) {
        const { data: bookingData } = await bookingsRes.json() as {
          data: Array<{ charger_id: string; status: string }>;
        };
        const ids = new Set(
          (bookingData ?? [])
            .filter(b => b.status === 'in_progress' || b.status === 'awaiting_end_confirmation')
            .map(b => b.charger_id),
        );
        setInProgressIds(ids);
      }
    } catch {
      setError('Failed to load chargers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const kycApproved = profile?.kyc_status === 'approved';

  // Apply filter
  const filtered = activeFilters.has('all')
    ? chargers
    : chargers.filter(c => activeFilters.has(c.status as FilterKey));

  // Apply sort
  const displayed = sortChargers(filtered, sort);

  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display font-extrabold text-3xl text-ink">My chargers</h1>
        <Link
          href="/lender/chargers/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-ink text-white text-sm font-bold rounded-xl hover:bg-ink/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </Link>
      </div>

      {/* KYC warning */}
      {!profileLoading && !kycApproved && (
        <div className="px-4 py-3 bg-yellow-50 rounded-2xl border border-yellow-200">
          <p className="text-sm text-yellow-800">
            Your chargers aren&apos;t visible to drivers yet.{' '}
            <Link href="/profile" className="font-semibold underline underline-offset-2">
              Verify your identity
            </Link>{' '}
            in Profile to publish them.
          </p>
        </div>
      )}

      {!loading && !error && chargers.length > 0 && (
        <>
          {/* Sort + filter row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <FilterChips
                chargers={chargers}
                activeFilters={activeFilters}
                onChange={setActiveFilters}
              />
            </div>
            <SortButton sort={sort} onChange={setSort} />
          </div>
        </>
      )}

      {/* States */}
      {loading && (
        <div className="text-center py-12 text-muted">Loading…</div>
      )}

      {!loading && error && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {error}
        </div>
      )}

      {!loading && !error && chargers.length === 0 && (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-volt-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-volt-deep" />
          </div>
          <p className="font-semibold text-ink">You haven&apos;t added any chargers yet</p>
          <p className="text-sm text-muted mt-1 mb-6">Add your first charger to start earning.</p>
          <Link
            href="/lender/chargers/new"
            className="inline-block px-6 py-3 bg-ink text-white font-bold rounded-2xl hover:bg-ink/90 transition-colors"
          >
            Add a charger
          </Link>
        </div>
      )}

      {!loading && !error && chargers.length > 0 && displayed.length === 0 && (
        <p className="text-center text-sm text-muted py-12">No chargers match this filter.</p>
      )}

      {!loading && !error && displayed.length > 0 && (
        <div className="space-y-4">
          {displayed.map(charger => (
            <ChargerTile
              key={charger.id}
              charger={charger}
              inUse={inProgressIds.has(charger.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default function LenderChargersPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted">Loading…</div>}>
      <LenderChargersContent />
    </Suspense>
  );
}
