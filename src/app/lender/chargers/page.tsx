'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Zap, Star, ArrowUpDown, ChevronDown, Filter, Check, X } from 'lucide-react';
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

// ─── Filter button + bottom sheet ────────────────────────────────────────────

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
  active: 'Live',
  paused: 'Paused',
  draft: 'Draft',
  suspended: 'Suspended',
};

function FilterButton({ activeFilter, onClick }: { activeFilter: FilterKey; onClick: () => void }) {
  const isFiltered = activeFilter !== 'all';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-semibold text-ink bg-gray-50',
        'border-[0.5px] transition-colors',
        isFiltered ? 'border-ink' : 'border-gray-300',
      )}
    >
      <Filter className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 text-left">Filter: {FILTER_LABELS[activeFilter]}</span>
      <ChevronDown className="w-3 h-3 shrink-0" />
    </button>
  );
}

function StatusFilterSheet({
  isOpen,
  chargers,
  activeFilter,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  chargers: Charger[];
  activeFilter: FilterKey;
  onSelect: (key: FilterKey) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const counts: Record<FilterKey, number> = {
    all: chargers.length,
    active: chargers.filter(c => c.status === 'active').length,
    paused: chargers.filter(c => c.status === 'paused').length,
    draft: chargers.filter(c => c.status === 'draft').length,
    suspended: chargers.filter(c => c.status === 'suspended').length,
  };

  const options: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Live' },
    { key: 'paused', label: 'Paused' },
    { key: 'draft', label: 'Draft' },
    { key: 'suspended', label: 'Suspended' },
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
          'fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Filter by status"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        {/* Header */}
        <div className="flex items-center px-4 pb-3 pt-1">
          <h2 className="font-display font-bold text-ink text-lg flex-1">Filter</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors" aria-label="Close">
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>
        {/* Options */}
        <div className="pb-8">
          {options.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { onSelect(key); onClose(); }}
              className="w-full flex items-center px-4 py-3.5 text-sm font-semibold text-ink hover:bg-gray-50 transition-colors"
            >
              <span className="flex-1 text-left">{label}</span>
              <span className="text-muted text-xs font-normal mr-3">{counts[key]}</span>
              <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                {activeFilter === key && <Check className="w-4 h-4 text-ink" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
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
          'flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-ink bg-gray-50',
          'border-[0.5px] transition-colors whitespace-nowrap',
          open ? 'border-ink' : 'border-gray-300',
        )}
      >
        <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
        {SORT_LABELS[sort]}
        <ChevronDown className={cn('w-3 h-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-md py-1 z-20 min-w-[152px]">
          {(['last_active', 'most_bookings', 'highest_rated', 'date_added'] as SortKey[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => { onChange(key); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ink hover:bg-gray-50 transition-colors"
            >
              <span className="flex-1 text-left">{SORT_LABELS[key]}</span>
              <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                {sort === key && <Check className="w-3.5 h-3.5 text-ink" />}
              </div>
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
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

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
  const filtered = activeFilter === 'all'
    ? chargers
    : chargers.filter(c => c.status === activeFilter);

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
        <div className="flex items-center gap-2">
          <FilterButton activeFilter={activeFilter} onClick={() => setFilterSheetOpen(true)} />
          <SortButton sort={sort} onChange={setSort} />
        </div>
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

      <StatusFilterSheet
        isOpen={filterSheetOpen}
        chargers={chargers}
        activeFilter={activeFilter}
        onSelect={setActiveFilter}
        onClose={() => setFilterSheetOpen(false)}
      />
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
