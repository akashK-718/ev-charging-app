'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ExternalLink, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
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
  users: { phone: string | null; name: string | null } | null;
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
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/kyc?status=all`)
      .then(r => r.json())
      .then((body: { data?: KycDetail[] }) => {
        const found = (body.data ?? []).find(s => s.id === id) ?? null;
        setSubmission(found);
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

  async function handleReject(resubmissionAllowed: boolean) {
    if (!rejectReason.trim()) {
      setActionError('Please provide a rejection reason.');
      return;
    }
    if (actionLoading) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/kyc/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim(), resubmission_allowed: resubmissionAllowed }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        setActionError(b.error ?? 'Failed to reject');
        return;
      }
      router.push('/admin/kyc');
    } catch {
      setActionError('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted">Loading…</div>;
  }

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

  return (
    <main className="min-h-screen px-6 py-10 space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-3xl text-ink">KYC review</h1>
        <p className="text-muted mt-1">{name} · {phone}</p>
        <p className="text-xs text-muted mt-0.5">
          Submitted {new Date(submission.submitted_at).toLocaleString('en-IN')}
        </p>
      </div>

      {/* Document details */}
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
                Bank: ••••{submission.bank_account_number?.slice(-4)} · {submission.bank_ifsc}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="space-y-4">
        {[
          { label: 'Aadhaar card', url: submission.aadhaar_photo_url },
          { label: 'PAN card', url: submission.pan_photo_url },
          { label: 'Selfie', url: submission.selfie_url },
        ].map(({ label, url }) => (
          <div key={label} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{label}</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-volt-deep font-semibold"
              >
                Open full size <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={label}
              className="w-full rounded-2xl border border-gray-100 object-cover max-h-64"
            />
          </div>
        ))}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {actionError}
        </div>
      )}

      {/* Reject / resubmit reason textarea */}
      {(actionMode === 'rejecting' || actionMode === 'resubmit') && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-ink">
            {actionMode === 'rejecting' ? 'Rejection reason' : 'Reason for requesting resubmission'}
          </label>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Explain what's wrong with the submission…"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt resize-none"
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setActionMode('idle'); setRejectReason(''); setActionError(null); }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={actionLoading || !rejectReason.trim()}
              onClick={() => { void handleReject(actionMode === 'resubmit'); }}
            >
              {actionLoading ? 'Processing…' : 'Confirm'}
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {actionMode === 'idle' && submission.status === 'pending' && (
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
              'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors disabled:opacity-50',
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

      {submission.status !== 'pending' && (
        <div className="px-4 py-3 bg-gray-50 rounded-2xl text-sm text-muted font-semibold">
          This submission has already been {submission.status}.
        </div>
      )}
    </main>
  );
}
