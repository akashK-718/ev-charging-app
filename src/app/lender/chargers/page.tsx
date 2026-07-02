'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MoreVertical, Plus, Zap, Pause, Play, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';

type Charger = {
  id: string;
  title: string;
  address: string;
  price_per_kwh: number;
  status: 'draft' | 'active' | 'paused' | 'suspended';
  total_sessions: number;
  charger_type: string;
  connector_types: string[];
};

type Filter = 'all' | 'active' | 'draft' | 'paused';

function ActionMenu({
  charger,
  onPause,
  onUnpause,
  onDelete,
}: {
  charger: Charger;
  onPause: () => void;
  onUnpause: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        aria-label="Charger options"
      >
        <MoreVertical className="w-4 h-4 text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 overflow-hidden">
          <Link
            href={`/lender/chargers/${charger.id}/edit`}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            <Edit3 className="w-4 h-4 text-muted" />
            Edit
          </Link>

          {charger.status === 'active' && (
            <button
              type="button"
              onClick={() => { setOpen(false); onPause(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50 transition-colors"
            >
              <Pause className="w-4 h-4 text-muted" />
              Pause
            </button>
          )}
          {charger.status === 'paused' && (
            <button
              type="button"
              onClick={() => { setOpen(false); onUnpause(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50 transition-colors"
            >
              <Play className="w-4 h-4 text-muted" />
              Unpause
            </button>
          )}

          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteModal({
  charger,
  onConfirm,
  onCancel,
  loading,
}: {
  charger: Charger;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
        <h2 className="font-display font-extrabold text-xl text-ink">Delete charger?</h2>
        <p className="text-sm text-muted mt-2">
          {charger.status === 'draft'
            ? `"${charger.title}" is a draft and will be deleted. You can recreate it anytime.`
            : `"${charger.title}" will be removed. Active bookings will still be honored.`}
        </p>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-ink hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-2xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterTabs({
  chargers,
  currentFilter,
}: {
  chargers: Charger[];
  currentFilter: Filter;
}) {
  const router = useRouter();

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all',    label: 'All',    count: chargers.length },
    { key: 'active', label: 'Live',   count: chargers.filter(c => c.status === 'active').length },
    { key: 'draft',  label: 'Drafts', count: chargers.filter(c => c.status === 'draft').length },
    { key: 'paused', label: 'Paused', count: chargers.filter(c => c.status === 'paused').length },
  ];

  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          onClick={() => router.replace(`/lender/chargers?filter=${tab.key}`)}
          className={cn(
            'px-3 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors',
            currentFilter === tab.key
              ? 'bg-ink text-white'
              : 'bg-gray-100 text-muted hover:bg-gray-200'
          )}
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  );
}

function LenderChargersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFilter = searchParams.get('filter') ?? 'all';
  const currentFilter: Filter = ['all', 'active', 'draft', 'paused'].includes(rawFilter)
    ? (rawFilter as Filter)
    : 'all';

  const { profile, loading: profileLoading } = useProfile();

  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Charger | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchLenderChargers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lender/chargers');
      if (!res.ok) { setError('Failed to load chargers'); return; }
      const body = await res.json() as { data: Charger[] };
      setChargers(body.data ?? []);
    } catch {
      setError('Failed to load chargers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLenderChargers();
  }, [fetchLenderChargers]);

  async function handlePause(charger: Charger) {
    setActionError(null);
    const res = await fetch(`/api/chargers/${charger.id}/pause`, { method: 'POST' });
    if (!res.ok) { setActionError('Failed to pause charger'); return; }
    setChargers(prev => prev.map(c => c.id === charger.id ? { ...c, status: 'paused' } : c));
  }

  async function handleUnpause(charger: Charger) {
    setActionError(null);
    const res = await fetch(`/api/chargers/${charger.id}/unpause`, { method: 'POST' });
    if (!res.ok) { setActionError('Failed to unpause charger'); return; }
    setChargers(prev => prev.map(c => c.id === charger.id ? { ...c, status: 'active' } : c));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/chargers/${deleteTarget.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setActionError('Failed to delete charger');
      setDeleteLoading(false);
      setDeleteTarget(null);
      return;
    }
    setChargers(prev => prev.filter(c => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleteLoading(false);
  }

  const kycApproved = profile?.kyc_status === 'approved';

  const filteredChargers = currentFilter === 'all'
    ? chargers
    : chargers.filter(c => c.status === currentFilter);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-extrabold text-3xl text-ink">Your chargers</h1>
        <Link
          href="/lender/chargers/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-ink text-white text-sm font-bold rounded-xl hover:bg-ink/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </Link>
      </div>

      {!profileLoading && !kycApproved && (
        <div className="mb-6 px-4 py-3 bg-yellow-50 rounded-2xl border border-yellow-200">
          <p className="text-sm text-yellow-800">
            Your chargers aren&apos;t visible to drivers yet.{' '}
            <Link href="/profile" className="font-semibold underline underline-offset-2">
              Verify your identity
            </Link>{' '}
            in Profile to publish them.
          </p>
        </div>
      )}

      {actionError && (
        <div className="mb-4 px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {actionError}
        </div>
      )}

      {/* Filter tabs — only show once chargers are loaded */}
      {!loading && !error && (
        <FilterTabs chargers={chargers} currentFilter={currentFilter} />
      )}

      {loading && (
        <div className="text-center py-12 text-muted">Loading…</div>
      )}

      {!loading && error && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {error}
        </div>
      )}

      {!loading && !error && filteredChargers.length === 0 && (
        currentFilter === 'all' ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-volt-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-7 h-7 text-volt-deep" />
            </div>
            <p className="font-semibold text-ink">No chargers yet</p>
            <p className="text-sm text-muted mt-1 mb-4">
              Add your first charger to start earning.
            </p>
            <Link
              href="/lender/chargers/new"
              className="inline-block px-6 py-3 bg-ink text-white font-bold rounded-2xl hover:bg-ink/90 transition-colors"
            >
              Add charger
            </Link>
          </div>
        ) : (
          <div className="text-center py-12 text-muted text-sm">
            No {currentFilter === 'active' ? 'live' : currentFilter} chargers.
          </div>
        )
      )}

      {!loading && !error && filteredChargers.length > 0 && (
        <div className="space-y-3">
          {filteredChargers.map(charger => (
            <div
              key={charger.id}
              className="bg-white rounded-2xl border border-gray-100 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/lender/chargers/${charger.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-ink text-sm truncate group-hover:underline">{charger.title}</p>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
                      charger.status === 'active' ? 'bg-volt-soft text-volt-deep' :
                      charger.status === 'paused' ? 'bg-yellow-50 text-yellow-700' :
                      charger.status === 'draft'  ? 'bg-gray-100 text-muted' :
                      'bg-red-50 text-red-700',
                    )}>
                      {charger.status === 'active' ? 'Live' :
                       charger.status === 'paused' ? 'Paused' :
                       charger.status === 'draft'  ? 'Awaiting verification' :
                       'Suspended'}
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate">{charger.address}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                    <span>₹{charger.price_per_kwh}/kWh</span>
                    <span>·</span>
                    <span>{charger.total_sessions} sessions</span>
                    <span>·</span>
                    <span>{charger.charger_type}</span>
                  </div>
                </Link>
                <ActionMenu
                  charger={charger}
                  onPause={() => { void handlePause(charger); }}
                  onUnpause={() => { void handleUnpause(charger); }}
                  onDelete={() => setDeleteTarget(charger)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          charger={deleteTarget}
          onConfirm={() => { void handleDelete(); }}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
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
