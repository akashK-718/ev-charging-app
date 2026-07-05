'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Edit3, Pause, Play, MoreVertical,
  Trash2, Copy, ExternalLink, Zap, MapPin, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChargerStatus = 'draft' | 'active' | 'paused' | 'suspended';

type ChargerDetail = {
  id: string;
  title: string;
  charger_type: string;
  connector_types: string[];
  price_per_kwh: number;
  address: string;
  photos: string[];
  instructions: string | null;
  status: ChargerStatus;
  avg_rating: number | null;
  total_sessions: number;
  created_at: string;
};

type Slot = { id: string; day_of_week: number[]; start_time: string; end_time: string };

type Stats = {
  totalBookings: number;
  totalEarningsPaise: number;
  weekBookings: number;
  weekEarningsPaise: number;
};

type BookingRow = {
  id: string;
  driver_id: string;
  driver_name: string | null;
  scheduled_start: string;
  scheduled_end: string;
  lender_payout?: number;
};

type DetailData = {
  charger: ChargerDetail;
  slots: Slot[];
  stats: Stats;
  upcoming: BookingRow[];
  recent: BookingRow[];
  activeCount: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHARGER_LABELS: Record<string, string> = {
  'AC_3.3kW': '3.3 kW AC', 'AC_7kW': '7 kW AC', 'AC_22kW': '22 kW AC', 'DC_fast': 'DC Fast',
};
const CONNECTOR_LABELS: Record<string, string> = {
  Type2: 'Type 2', BharatAC: 'Bharat AC', CCS2: 'CCS2', CHAdeMO: 'CHAdeMO', Type1: 'Type 1',
};
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function shortCity(address: string): string {
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2];
    return candidate.replace(/^\d{6}\s*/, '').trim() || candidate;
  }
  return address;
}

function sinceLabel(status: ChargerStatus, createdAt: string): string {
  const d = new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (status === 'active') return `Live since ${d}`;
  if (status === 'draft') return `Draft since ${d}`;
  if (status === 'paused') return `Paused since ${d}`;
  return d;
}

function formatDuration(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function slotLabel(slot: Slot): string {
  const days = slot.day_of_week.map(d => DAY_LABELS[d] ?? '?').join(', ');
  return `${days}  ${slot.start_time}–${slot.end_time}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ChargerStatus }) {
  return (
    <span className={cn(
      'px-2.5 py-1 rounded-full text-xs font-semibold',
      status === 'active'  ? 'bg-volt-soft text-volt-deep' :
      status === 'draft'   ? 'bg-yellow-50 text-yellow-700' :
      status === 'paused'  ? 'bg-gray-100 text-muted' :
                             'bg-red-50 text-red-700',
    )}>
      {status === 'active' ? 'Live' : status === 'draft' ? 'Draft' : status === 'paused' ? 'Paused' : 'Suspended'}
    </span>
  );
}

function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
      <p className="text-xl font-display font-extrabold text-ink">{value}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
      {sub && <p className="text-xs font-semibold text-volt-deep mt-0.5">{sub}</p>}
    </div>
  );
}

function ConfirmModal({
  title, body, confirmLabel, confirmClass, onConfirm, onCancel, loading,
}: {
  title: string; body: string; confirmLabel: string; confirmClass: string;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
        <h2 className="font-display font-extrabold text-xl text-ink">{title}</h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">{body}</p>
        <div className="flex gap-3 mt-6">
          <button
            type="button" onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-ink hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button" onClick={onConfirm} disabled={loading}
            className={cn('flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50', confirmClass)}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LenderChargerDetailPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const chargerId = params.id;

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expandInstructions, setExpandInstructions] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    fetch(`/api/lender/chargers/${chargerId}`)
      .then(async res => {
        if (!res.ok) { setError('Charger not found'); return; }
        const body = await res.json() as DetailData;
        setData(body);
      })
      .catch(() => setError('Failed to load charger'))
      .finally(() => setLoading(false));
  }, [chargerId]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // ── Actions ──────────────────────────────────────────────────────────────

  function handleEditClick() {
    if ((data?.activeCount ?? 0) > 0) { setShowEditWarning(true); return; }
    router.push(`/lender/chargers/${chargerId}/edit`);
  }

  function handlePauseClick() {
    if ((data?.activeCount ?? 0) > 0) { setShowPauseConfirm(true); return; }
    void doPause();
  }

  async function doPause() {
    setActionLoading(true);
    const res = await fetch(`/api/chargers/${chargerId}/pause`, { method: 'POST' });
    setActionLoading(false);
    if (!res.ok) { showToast('Failed to pause'); return; }
    setData(prev => prev ? { ...prev, charger: { ...prev.charger, status: 'paused' } } : prev);
    setShowPauseConfirm(false);
  }

  async function doUnpause() {
    setActionLoading(true);
    const res = await fetch(`/api/chargers/${chargerId}/unpause`, { method: 'POST' });
    setActionLoading(false);
    if (!res.ok) { showToast('Failed to resume'); return; }
    setData(prev => prev ? { ...prev, charger: { ...prev.charger, status: 'active' } } : prev);
  }

  async function doDelete() {
    setActionLoading(true);
    const res = await fetch(`/api/chargers/${chargerId}`, { method: 'DELETE' });
    setActionLoading(false);
    if (!res.ok) { showToast('Failed to delete'); return; }
    router.push('/lender/chargers');
  }

  function handleShare() {
    setMenuOpen(false);
    const url = `${window.location.origin}/chargers/${chargerId}`;
    void navigator.clipboard.writeText(url).then(() => showToast('Link copied'));
  }

  async function handleDuplicate() {
    setMenuOpen(false);
    setDuplicating(true);
    try {
      const res = await fetch(`/api/lender/chargers/${chargerId}/duplicate`, { method: 'POST' });
      if (!res.ok) { showToast('Failed to duplicate'); return; }
      const { id } = await res.json() as { id: string };
      router.push(`/lender/chargers/${id}/edit`);
    } catch {
      showToast('Failed to duplicate');
    } finally {
      setDuplicating(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="px-6 py-10">
        <p className="text-sm text-red-600 font-semibold">{error ?? 'Not found'}</p>
        <Link href="/lender/chargers" className="mt-4 inline-block text-sm font-semibold text-volt-deep">← Back</Link>
      </main>
    );
  }

  const { charger, slots, stats, upcoming, recent, activeCount } = data;
  const earningsRupees = Math.floor(stats.totalEarningsPaise / 100);
  const weekEarningsRupees = Math.floor(stats.weekEarningsPaise / 100);
  const coverPhoto = charger.photos?.[0] ?? null;
  const instructions = charger.instructions ?? '';
  const instructionsTruncated = instructions.length > 160 && !expandInstructions;

  return (
    <>
      <main className="min-h-screen pb-28">

        {/* ── Header ── */}
        <div className="relative">
          {coverPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPhoto} alt={charger.title} className="w-full aspect-[16/9] object-cover" />
          ) : (
            <div className="w-full aspect-[16/9] bg-volt-soft flex items-center justify-center">
              <Zap className="w-16 h-16 text-volt opacity-30" />
            </div>
          )}
          <button
            type="button"
            onClick={() => router.back()}
            className="absolute top-4 left-4 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow"
          >
            <ChevronLeft className="w-5 h-5 text-ink" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* Title + status */}
          <div>
            <div className="flex items-start gap-3 justify-between">
              <h1 className="font-display font-extrabold text-2xl text-ink leading-tight flex-1">
                {charger.title}
              </h1>
              <StatusBadge status={charger.status} />
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-sm text-muted">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{shortCity(charger.address)}</span>
              <span>·</span>
              <span>{sinceLabel(charger.status, charger.created_at)}</span>
            </div>
          </div>

          {/* Draft banner */}
          {charger.status === 'draft' && (
            <div className="px-4 py-3 bg-yellow-50 rounded-2xl border border-yellow-200">
              <p className="text-sm text-yellow-800">
                This charger is not live yet.{' '}
                <Link href="/profile" className="font-semibold underline underline-offset-2">
                  Complete verification in Profile
                </Link>{' '}
                to publish it.
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={String(stats.totalBookings)}
              label="Total bookings"
            />
            <StatCard
              value={`₹${earningsRupees}`}
              label="Total earned"
            />
            <StatCard
              value={String(stats.weekBookings)}
              label="This week"
              sub={weekEarningsRupees > 0 ? `₹${weekEarningsRupees}` : undefined}
            />
            <StatCard
              value={charger.avg_rating ? charger.avg_rating.toFixed(1) : '—'}
              label="Avg rating"
              sub={charger.avg_rating ? undefined : 'No ratings yet'}
            />
          </div>

          {/* Upcoming bookings */}
          <div>
            <h2 className="font-semibold text-base text-ink mb-3">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">No upcoming bookings.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(b => (
                  <Link
                    key={b.id}
                    href={`/lender/bookings/${b.id}`}
                    className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {b.driver_name ?? 'Driver'}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {new Date(b.scheduled_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' '}
                        {new Date(b.scheduled_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        {' · '}
                        {formatDuration(b.scheduled_start, b.scheduled_end)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-volt-soft text-volt-deep">Confirmed</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div>
            <h2 className="font-semibold text-base text-ink mb-3">Recent activity</h2>
            {recent.length === 0 ? (
              <p className="text-sm text-muted">No bookings yet.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {recent.map(b => (
                    <Link
                      key={b.id}
                      href={`/lender/bookings/${b.id}`}
                      className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {b.driver_name ?? 'Driver'}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {new Date(b.scheduled_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          {' · '}
                          {formatDuration(b.scheduled_start, b.scheduled_end)}
                        </p>
                      </div>
                      {(b.lender_payout ?? 0) > 0 && (
                        <p className="text-sm font-bold text-ink">
                          ₹{Math.floor((b.lender_payout ?? 0) / 100)}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
                <Link
                  href={`/lender/bookings?charger=${chargerId}`}
                  className="block mt-3 text-center text-sm font-semibold text-volt-deep"
                >
                  View all bookings
                </Link>
              </>
            )}
          </div>

          {/* Details */}
          <div className="space-y-4">
            <h2 className="font-semibold text-base text-ink">Details</h2>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
              {/* Charger type + connectors */}
              <div>
                <p className="text-xs text-muted mb-1.5">Charger type</p>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-volt-deep" />
                  <span className="text-sm font-semibold text-ink">{CHARGER_LABELS[charger.charger_type] ?? charger.charger_type}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted mb-1.5">Connectors</p>
                <div className="flex flex-wrap gap-1.5">
                  {charger.connector_types.map(ct => (
                    <span key={ct} className="px-2 py-0.5 rounded-lg bg-volt-soft text-ink text-xs font-semibold">
                      {CONNECTOR_LABELS[ct] ?? ct}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-xs text-muted">Price</p>
                <p className="text-sm font-bold text-ink">₹{charger.price_per_kwh}/kWh</p>
              </div>

              <Link
                href={`/chargers?charger_id=${chargerId}`}
                className="flex items-start justify-between gap-2 group"
              >
                <div>
                  <p className="text-xs text-muted mb-1">Address</p>
                  <p className="text-sm text-ink leading-snug">{charger.address}</p>
                  <p className="text-xs text-volt-deep font-semibold mt-0.5 group-hover:underline">
                    View on map
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-5" />
              </Link>

              {instructions && (
                <div>
                  <p className="text-xs text-muted mb-1">Access instructions</p>
                  <p className="text-sm text-ink leading-relaxed">
                    {instructionsTruncated ? `${instructions.slice(0, 160)}…` : instructions}
                  </p>
                  {instructions.length > 160 && (
                    <button
                      type="button"
                      onClick={() => setExpandInstructions(v => !v)}
                      className="mt-1 text-xs font-semibold text-volt-deep"
                    >
                      {expandInstructions ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}

              {slots.length > 0 && (
                <div>
                  <p className="text-xs text-muted mb-1.5">Availability</p>
                  <div className="space-y-1">
                    {slots.map(slot => (
                      <p key={slot.id} className="text-sm text-ink font-mono text-xs">{slotLabel(slot)}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Photo carousel */}
            {charger.photos.length > 1 && (
              <div>
                <p className="text-xs text-muted mb-2">Photos</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {charger.photos.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={url} alt={`Photo ${i + 1}`} className="w-28 h-20 rounded-xl object-cover shrink-0" />
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── Sticky action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-2 z-40">
        <button
          type="button"
          onClick={handleEditClick}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-ink text-white text-sm font-bold rounded-2xl hover:bg-ink/90 transition-colors"
        >
          <Edit3 className="w-4 h-4" />
          Edit
        </button>

        {charger.status === 'active' && (
          <button
            type="button"
            onClick={handlePauseClick}
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-ink text-sm font-bold rounded-2xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
        )}
        {charger.status === 'paused' && (
          <button
            type="button"
            onClick={() => { void doUnpause(); }}
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-volt-soft text-volt-deep text-sm font-bold rounded-2xl hover:bg-volt/20 transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        )}

        {/* ⋮ menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-ink" />
          </button>

          {menuOpen && (
            <div className="absolute bottom-14 right-0 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 overflow-hidden z-50">
              <button
                type="button"
                onClick={handleShare}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink hover:bg-gray-50 transition-colors"
              >
                <Copy className="w-4 h-4 text-muted" />
                Share listing
              </button>
              <a
                href={`/chargers/${chargerId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-muted" />
                View public listing
              </a>
              <button
                type="button"
                onClick={() => { void handleDuplicate(); }}
                disabled={duplicating}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Star className="w-4 h-4 text-muted" />
                {duplicating ? 'Duplicating…' : 'Duplicate'}
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setShowDelete(true); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-ink text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg z-50 pointer-events-none">
          {toast}
        </div>
      )}

      {/* ── Modals ── */}
      {showDelete && (
        <ConfirmModal
          title="Delete this charger?"
          body={`"${charger.title}" will be removed. Active bookings will still be honored. This can't be undone.`}
          confirmLabel="Delete"
          confirmClass="bg-red-600 hover:bg-red-700"
          onConfirm={() => { void doDelete(); }}
          onCancel={() => setShowDelete(false)}
          loading={actionLoading}
        />
      )}

      {showPauseConfirm && (
        <ConfirmModal
          title="Pause this charger?"
          body={`You have ${activeCount} active booking${activeCount > 1 ? 's' : ''} on this charger. Pausing will hide it from new drivers but won't cancel existing bookings.`}
          confirmLabel="Pause anyway"
          confirmClass="bg-ink hover:bg-ink/90"
          onConfirm={() => { void doPause(); }}
          onCancel={() => setShowPauseConfirm(false)}
          loading={actionLoading}
        />
      )}

      {showEditWarning && (
        <ConfirmModal
          title="Charger has active bookings"
          body={`You have ${activeCount} active booking${activeCount > 1 ? 's' : ''} on this charger. Changes to price, availability, or location may affect them.`}
          confirmLabel="Continue to edit"
          confirmClass="bg-ink hover:bg-ink/90"
          onConfirm={() => { setShowEditWarning(false); router.push(`/lender/chargers/${chargerId}/edit`); }}
          onCancel={() => setShowEditWarning(false)}
          loading={false}
        />
      )}
    </>
  );
}
