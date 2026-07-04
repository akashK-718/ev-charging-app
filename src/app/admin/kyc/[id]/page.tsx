'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ExternalLink, CheckCircle2, XCircle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type KycDetail = {
  id: string;
  user_id: string;
  aadhaar_photo_url: string;
  pan_photo_url: string;
  selfie_url: string;
  pan_number: string;
  aadhaar_last_4: string;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  upi_id: string | null;
  status: string;
  submitted_at: string;
  rejection_reason: string | null;
  users: {
    phone: string | null;
    name: string | null;
    role: string | null;
    created_at: string | null;
  } | null;
  draft_count?: number;
};

type ActionMode = 'idle' | 'rejecting' | 'resubmit';

export default function AdminKycDetailPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const id = params.id;

  const [submission, setSubmission] = useState<KycDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>('idle');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/kyc/${id}`)
      .then(r => r.json())
      .then((body: { data?: KycDetail; error?: string }) => {
        if (body.error) { setError(body.error); return; }
        setSubmission(body.data ?? null);
      })
      .catch(() => setError('Failed to load submission'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleApprove() {
    if (actionLoading) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/kyc/${id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        setActionError(b.error ?? 'Failed to approve');
        return;
      }
      router.push('/admin/kyc');
    } catch {
      setActionError('Failed to approve');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setActionError('Reason must be at least 10 characters.');
      return;
    }
    if (actionLoading) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/kyc/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        setActionError(b.error ?? 'Failed to reject');
        return;
      }
      router.push('/admin/kyc?status=rejected');
    } catch {
      setActionError('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResubmit() {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setActionError('Reason must be at least 10 characters.');
      return;
    }
    if (actionLoading) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/kyc/${id}/request-resubmission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        setActionError(b.error ?? 'Failed to request resubmission');
        return;
      }
      router.push('/admin/kyc?status=resubmission_required');
    } catch {
      setActionError('Failed to request resubmission');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="text-center py-20 text-muted">Loading…</div>;

  if (error || !submission) {
    return (
      <div className="px-6 py-12">
        <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {error ?? 'Submission not found'}
        </div>
      </div>
    );
  }

  const name = submission.users?.name ?? 'Unknown';
  const phone = submission.users?.phone ?? '—';
  const role = submission.users?.role ?? '—';
  const memberSince = submission.users?.created_at
    ? new Date(submission.users.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—';
  const drafts = submission.draft_count ?? 0;
  const isPending = submission.status === 'pending';

  return (
    <>
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Document"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <main className="min-h-screen px-6 py-10 space-y-6 pb-32">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-ink">KYC review</h1>
          <p className="text-muted mt-1">{name} · {phone}</p>
          <p className="text-xs text-muted mt-0.5">
            Submitted {new Date(submission.submitted_at).toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-2">
          <h2 className="font-semibold text-sm text-ink">User context</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted text-xs">Role</p>
              <p className="font-semibold text-ink capitalize">{role}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Member since</p>
              <p className="font-semibold text-ink">{memberSince}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Draft chargers</p>
              <p className={cn('font-semibold', drafts > 0 ? 'text-amber-700' : 'text-ink')}>
                {drafts > 0 ? `${drafts} will go live on approval` : 'None'}
              </p>
            </div>
            <div>
              <p className="text-muted text-xs">Status</p>
              <p className="font-semibold text-ink capitalize">{submission.status.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <h2 className="font-semibold text-sm text-ink">Document details</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted text-xs">PAN number</p>
              <p className="font-mono font-semibold text-ink tracking-widest">{submission.pan_number}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Aadhaar last 4</p>
              <p className="font-semibold text-ink">••••{submission.aadhaar_last_4}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted text-xs">Payout method</p>
              {submission.upi_id ? (
                <p className="font-semibold text-ink">UPI: {submission.upi_id}</p>
              ) : (
                <p className="font-semibold text-ink">
                  Bank ••••{submission.bank_account_number?.slice(-4)} · {submission.bank_ifsc}
                </p>
              )}
            </div>
          </div>
        </div>

        {submission.rejection_reason && (
          <div className="px-4 py-3 bg-red-50 rounded-2xl border border-red-100">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Prior rejection reason</p>
            <p className="text-sm text-red-800">{submission.rejection_reason}</p>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="font-semibold text-sm text-ink">Documents</h2>
          {[
            { label: 'Aadhaar card', url: submission.aadhaar_photo_url },
            { label: 'PAN card',     url: submission.pan_photo_url },
            { label: 'Selfie',       url: submission.selfie_url },
          ].map(({ label, url }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">{label}</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-volt-deep font-semibold"
                >
                  Full size <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={label}
                className="w-full rounded-2xl border border-gray-100 object-cover max-h-56 cursor-zoom-in"
                onClick={() => setLightboxUrl(url)}
              />
            </div>
          ))}
        </div>

        {actionError && (
          <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
            {actionError}
          </div>
        )}

        {(actionMode === 'rejecting' || actionMode === 'resubmit') && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-ink">
              {actionMode === 'rejecting' ? 'Rejection reason' : 'Reason for requesting resubmission'}
              <span className="text-muted font-normal ml-1">(min 10 characters)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Explain what needs to be corrected…"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setActionMode('idle'); setReason(''); setActionError(null); }}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading || reason.trim().length < 10}
                onClick={() => { void (actionMode === 'rejecting' ? handleReject() : handleResubmit()); }}
              >
                {actionLoading ? 'Processing…' : 'Confirm'}
              </Button>
            </div>
          </div>
        )}

        {actionMode === 'idle' && isPending && (
          <div className="space-y-2 pb-6">
            <Button
              variant="secondary"
              size="lg"
              disabled={actionLoading}
              className="flex items-center gap-2 justify-center"
              onClick={() => { void handleApprove(); }}
            >
              <CheckCircle2 className="w-5 h-5" />
              {actionLoading ? 'Approving…' : 'Approve KYC'}
            </Button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setActionMode('resubmit')}
              className={cn(
                'w-full flex items-center gap-2 justify-center px-6 py-3 rounded-2xl text-sm font-bold',
                'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50',
              )}
            >
              <RefreshCw className="w-4 h-4" />
              Request resubmission
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setActionMode('rejecting')}
              className={cn(
                'w-full flex items-center gap-2 justify-center px-6 py-3 rounded-2xl text-sm font-bold',
                'bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50',
              )}
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        )}

        {!isPending && actionMode === 'idle' && (
          <div className="px-4 py-3 bg-gray-50 rounded-2xl text-sm text-muted font-semibold">
            This submission has already been {submission.status.replace('_', ' ')}.
          </div>
        )}
      </main>
    </>
  );
}
