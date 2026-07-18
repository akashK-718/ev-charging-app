'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil, ShieldCheck, ShieldX, Clock, ShieldAlert,
  Camera, ImageIcon, ShieldQuestion, Trash2,
  Smartphone, Check, Home, Car, CreditCard,
  ChevronRight, Bell, Globe, ArrowRight,
} from 'lucide-react';
import { NameEditor } from './NameEditor';
import { Avatar } from '@/components/ui/Avatar';
import { Sheet } from '@/components/ui/Sheet';
import { uploadImage } from '@/lib/cloudinary';
import { ImageCropper } from '@/components/ui/ImageCropper';
import { clearPwaDismissal } from '@/lib/pwa';

// ── Types ──────────────────────────────────────────────────────────────────────

type HostingState = 'not_enabled' | 'setup_in_progress' | 'setup_deferred' | 'active' | 'paused';

interface ChargerStats {
  published: number;
  visible: number;
  draft: number;
}

interface Submission {
  id: string;
  status: string;
  submitted_at: string;
  rejection_reason: string | null;
}

interface ProfileBodyProps {
  initialName: string | null;
  phone: string;
  hostingState: HostingState;
  chargerStats: ChargerStats;
  createdAt: string;
  kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected';
  submission: Submission | null;
  showSubmittedBanner: boolean;
  initialAvatarUrl: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Hosting toggle ─────────────────────────────────────────────────────────────

function HostingToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        active ? 'bg-green focus-visible:ring-green' : 'bg-gray-300 focus-visible:ring-gray-400'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          active ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProfileBody({
  initialName,
  phone,
  hostingState: initialHostingState,
  chargerStats,
  createdAt,
  kycStatus,
  submission,
  showSubmittedBanner,
  initialAvatarUrl,
}: ProfileBodyProps) {
  const router = useRouter();

  // ── Avatar state ─────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Hosting state ─────────────────────────────────────────────────────────────
  const [hostingState, setHostingState] = useState<HostingState>(initialHostingState);
  const [pauseSheetOpen, setPauseSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [hostingLoading, setHostingLoading] = useState(false);
  const [hostingError, setHostingError] = useState<string | null>(null);

  // ── Preferences state ─────────────────────────────────────────────────────────
  const [installResetDone, setInstallResetDone] = useState(false);

  const hostingStarted = hostingState !== 'not_enabled';

  // Setup in progress: route to verification or first charger based on KYC status.
  // Append ?from=onboarding so those screens know to show their destructive actions.

  // ── Avatar handlers ───────────────────────────────────────────────────────────

  async function handleCropConfirm(blob: Blob) {
    setCropFile(null);
    setAvatarLoading(true);
    setAvatarError(null);
    try {
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const url = await uploadImage(file);
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: url }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setAvatarUrl(url);
    } catch {
      setAvatarError('Could not upload photo. Please try again.');
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleResetAvatar() {
    setAvatarLoading(true);
    setAvatarError(null);
    try {
      const res = await fetch('/api/users/me/reset-avatar', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reset');
      const data = await res.json() as { avatar_url: string };
      setAvatarUrl(data.avatar_url);
    } catch {
      setAvatarError('Could not reset avatar. Please try again.');
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarLoading(true);
    setAvatarError(null);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: null }),
      });
      if (!res.ok) throw new Error('Failed to remove');
      setAvatarUrl(null);
    } catch {
      setAvatarError('Could not remove photo. Please try again.');
    } finally {
      setAvatarLoading(false);
    }
  }

  function openCamera() {
    setAvatarSheetOpen(false);
    setTimeout(() => cameraInputRef.current?.click(), 50);
  }

  function openFilePicker() {
    setAvatarSheetOpen(false);
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  // ── Hosting handlers ──────────────────────────────────────────────────────────

  async function handleStartHosting() {
    setHostingLoading(true);
    setHostingError(null);
    try {
      const res = await fetch('/api/profile/enable-hosting', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setHostingError(data.error ?? 'Could not enable hosting. Please try again.');
        return;
      }
      setHostingState('setup_in_progress');
      router.refresh();
    } catch {
      setHostingError('Could not enable hosting. Please try again.');
    } finally {
      setHostingLoading(false);
    }
  }

  async function handleConfirmPause() {
    setPauseSheetOpen(false);
    setHostingLoading(true);
    setHostingError(null);
    try {
      const res = await fetch('/api/profile/pause-hosting', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setHostingError(data.error ?? 'Could not pause hosting. Please try again.');
        return;
      }
      setHostingState('paused');
      router.refresh();
    } catch {
      setHostingError('Could not pause hosting. Please try again.');
    } finally {
      setHostingLoading(false);
    }
  }

  async function handleResume() {
    setHostingLoading(true);
    setHostingError(null);
    try {
      const res = await fetch('/api/profile/resume-hosting', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setHostingError(data.error ?? 'Could not resume hosting. Please try again.');
        return;
      }
      setHostingState('active');
      router.refresh();
    } catch {
      setHostingError('Could not resume hosting. Please try again.');
    } finally {
      setHostingLoading(false);
    }
  }

  function handleToggle() {
    if (hostingLoading) return;
    if (hostingState === 'active') {
      setPauseSheetOpen(true);
    } else if (hostingState === 'paused') {
      void handleResume();
    }
  }

  const setupContinueHref = kycStatus === 'approved'
    ? '/lender/chargers/new?from=onboarding'
    : '/profile/verify?from=onboarding';

  async function handleLeaveSetup() {
    setLeaveSheetOpen(false);
    setHostingLoading(true);
    try {
      await fetch('/api/profile/defer-hosting-setup', { method: 'POST' });
      setHostingState('setup_deferred');
      router.refresh();
    } catch {
      // best-effort: show the softer card even if the API call fails
      setHostingState('setup_deferred');
    } finally {
      setHostingLoading(false);
    }
  }

  function handleResumeSetup() {
    // Clear deferred flag in background — non-blocking so navigation is instant
    void fetch('/api/profile/resume-hosting-setup', { method: 'POST' });
    router.push(setupContinueHref);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {cropFile && (
        <ImageCropper
          file={cropFile}
          aspectRatio="1:1"
          onConfirm={blob => { void handleCropConfirm(blob); }}
          onCancel={() => setCropFile(null)}
        />
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) setCropFile(f);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) setCropFile(f);
          e.target.value = '';
        }}
      />

      {/* Verification submitted banner */}
      {showSubmittedBanner && hostingStarted && kycStatus === 'pending' && (
        <div className="px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
          <p className="font-semibold text-blue-800">Verification submitted!</p>
          <p className="text-sm text-blue-700 mt-0.5">We&apos;ll review your documents within 24–48 hours.</p>
        </div>
      )}

      {/* ── 1. Account ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-base text-ink">Account</h2>

        {/* Avatar */}
        <div className="flex flex-col items-center py-2">
          <div className="relative">
            {avatarLoading ? (
              <div className="w-20 h-20 rounded-full bg-gray-100 animate-pulse" />
            ) : (
              <Avatar avatarUrl={avatarUrl} name={initialName} size="lg" />
            )}
            <button
              type="button"
              onClick={() => setAvatarSheetOpen(true)}
              aria-label="Edit profile photo"
              className="absolute bottom-0 right-0 w-6 h-6 bg-ink text-white rounded-full flex items-center justify-center shadow-md hover:bg-ink/80 transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
          {avatarError && (
            <p className="text-xs text-red-600 font-medium mt-2 text-center">{avatarError}</p>
          )}
        </div>

        <div className="space-y-3">
          <NameEditor initialName={initialName} showKycContext={hostingStarted} />
          <div>
            <p className="text-xs text-muted mb-0.5">Phone</p>
            <p className="text-sm font-semibold text-ink">{phone}</p>
            <p className="text-xs text-muted mt-1">
              To change your phone number,{' '}
              <a href="mailto:support@example.com" className="underline hover:text-ink transition-colors">
                contact support
              </a>
              .
            </p>
          </div>
          <div>
            <p className="text-xs text-muted mb-0.5">Member since</p>
            <p className="text-sm font-semibold text-ink">{formatDate(createdAt)}</p>
          </div>
        </div>
      </div>

      {/* ── 2. Hosting — four-state lifecycle ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">

        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-token flex items-center justify-center shrink-0 ${
            hostingState === 'active'  ? 'bg-green-soft' :
            hostingState === 'paused'  ? 'bg-surface-page' :
                                         'bg-copper-soft'
          }`}>
            <Home className={`w-4 h-4 ${
              hostingState === 'active' ? 'text-green' :
              hostingState === 'paused' ? 'text-muted' :
                                          'text-copper'
            }`} aria-hidden />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Hosting</p>

              {hostingState === 'not_enabled' && (
                <span className="text-xs text-muted shrink-0">Not enabled</span>
              )}

              {hostingState === 'setup_in_progress' && (
                <span className="text-xs font-medium text-copper shrink-0">Setup in progress</span>
              )}

              {(hostingState === 'active' || hostingState === 'paused') && (
                <div className="flex items-center gap-2 shrink-0">
                  {hostingState === 'active' ? (
                    <div className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-green" aria-hidden />
                      <span className="text-xs font-semibold text-green">Active</span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-muted">Paused</span>
                  )}
                  <HostingToggle
                    active={hostingState === 'active'}
                    onClick={handleToggle}
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-muted mt-0.5">
              {hostingState === 'not_enabled' && 'Earn from your home charger.'}
              {hostingState === 'setup_in_progress' && 'Verify your identity and list your first charger.'}
              {hostingState === 'setup_deferred' && 'Start earning with your home charger.'}
              {hostingState === 'active' && (
                `${chargerStats.published} Charger${chargerStats.published !== 1 ? 's' : ''} · ${chargerStats.visible} Visible${chargerStats.draft > 0 ? ` · ${chargerStats.draft} Draft` : ''}`
              )}
              {hostingState === 'paused' && 'Your listings are hidden from search.'}
            </p>
          </div>
        </div>

        {/* Action row */}
        <div className="mt-3 pt-3 border-t border-border">
          {hostingState === 'not_enabled' && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">Share your charger when you&apos;re not using it.</p>
              <button
                type="button"
                onClick={() => { void handleStartHosting(); }}
                disabled={hostingLoading}
                className="shrink-0 px-4 py-2 bg-ink text-white text-xs font-semibold rounded-token hover:bg-ink/90 transition-colors disabled:opacity-50"
              >
                {hostingLoading ? 'Starting…' : 'Start Hosting'}
              </button>
            </div>
          )}

          {hostingState === 'setup_in_progress' && (
            <div className="flex flex-col gap-2">
              <Link
                href={setupContinueHref}
                className="inline-flex items-center gap-1 text-sm font-semibold text-ink hover:underline underline-offset-2 transition-colors"
              >
                Continue
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => setLeaveSheetOpen(true)}
                className="text-xs text-muted hover:text-ink transition-colors text-left w-fit"
              >
                Not now
              </button>
            </div>
          )}

          {hostingState === 'setup_deferred' && (
            <button
              type="button"
              onClick={handleResumeSetup}
              className="inline-flex items-center gap-1 text-sm font-semibold text-copper hover:underline underline-offset-2 transition-colors"
            >
              Resume setup
              <ArrowRight className="w-4 h-4" aria-hidden />
            </button>
          )}

          {hostingState === 'active' && (
            <Link
              href="/lender/dashboard"
              className="inline-flex items-center gap-1 text-sm font-semibold text-copper hover:underline underline-offset-2 transition-colors"
            >
              Manage Hosting
              <ChevronRight className="w-4 h-4" aria-hidden />
            </Link>
          )}

          {hostingState === 'paused' && (
            <div className="flex items-center gap-5 flex-wrap">
              <button
                type="button"
                onClick={() => { void handleResume(); }}
                disabled={hostingLoading}
                className="text-sm font-semibold text-green hover:underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                {hostingLoading ? 'Resuming…' : 'Resume Hosting'}
              </button>
              <Link
                href="/lender/dashboard"
                className="text-sm font-semibold text-copper hover:underline underline-offset-2 transition-colors"
              >
                Manage Hosting
              </Link>
            </div>
          )}

          {hostingError && (
            <p className="text-xs text-danger font-medium mt-2">{hostingError}</p>
          )}
        </div>
      </div>

      {/* ── 3. Verification — only when hosting has been started ───────────────── */}
      {hostingStarted && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-base text-ink">Identity verification</h2>

          {kycStatus === 'not_started' && (
            <div className="space-y-4">
              <div className="flex gap-3 p-4 rounded-xl border bg-yellow-50 border-yellow-200">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600" />
                <div>
                  <p className="font-semibold text-sm text-yellow-700">Not verified</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {chargerStats.draft > 0
                      ? `You have ${chargerStats.draft} charger${chargerStats.draft > 1 ? 's' : ''} awaiting publish. Verify your identity to make them visible to drivers.`
                      : 'Verify your identity to publish chargers and receive payouts.'}
                  </p>
                </div>
              </div>
              <Link
                href="/profile/verify"
                className="block w-full text-center px-4 py-3 bg-ink text-white text-sm font-bold rounded-xl hover:bg-ink/90 transition-colors"
              >
                Start verification
              </Link>
            </div>
          )}

          {kycStatus === 'pending' && submission && (
            <div className="flex gap-3 p-4 rounded-xl border bg-blue-50 border-blue-200">
              <Clock className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
              <div>
                <p className="font-semibold text-sm text-blue-700">Under review</p>
                <p className="text-xs text-muted mt-1">
                  Submitted {formatDate(submission.submitted_at)} · Usually 24–48 hours.
                  {chargerStats.draft > 0 && ` Your ${chargerStats.draft} charger${chargerStats.draft > 1 ? 's' : ''} will go live automatically once approved.`}
                </p>
              </div>
            </div>
          )}

          {kycStatus === 'approved' && (
            <div className="flex gap-3 p-4 rounded-xl border bg-green-50 border-green-200">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />
              <div>
                <p className="font-semibold text-sm text-green-700">Verified</p>
                {submission && (
                  <p className="text-xs text-muted mt-1">Verified on {formatDate(submission.submitted_at)}</p>
                )}
              </div>
            </div>
          )}

          {kycStatus === 'rejected' && (
            <div className="space-y-4">
              <div className="flex gap-3 p-4 rounded-xl border bg-red-50 border-red-200">
                <ShieldX className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p className="font-semibold text-sm text-red-700">Verification rejected</p>
                  {submission?.rejection_reason && (
                    <p className="text-xs text-muted mt-1">Reason: {submission.rejection_reason}</p>
                  )}
                  <p className="text-xs text-muted mt-1">Please resubmit with clearer, well-lit photos.</p>
                </div>
              </div>
              <Link
                href="/profile/verify"
                className="block w-full text-center px-4 py-3 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-colors"
              >
                Resubmit documents
              </Link>
            </div>
          )}

          <p className="text-xs text-muted">
            We collect Aadhaar and PAN for identity verification as required by Indian payment regulations.
            Documents are reviewed by our team and not shared with third parties.
          </p>
        </div>
      )}

      {/* ── 4. Vehicles ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 opacity-50">
          <div className="flex items-center gap-3">
            <Car className="w-4 h-4 text-muted shrink-0" aria-hidden />
            <p className="text-sm font-semibold text-ink">Vehicles</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Coming soon</span>
            <ChevronRight className="w-4 h-4 text-muted" aria-hidden />
          </div>
        </div>
      </div>

      {/* ── 5. Payment methods ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 opacity-50">
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-muted shrink-0" aria-hidden />
            <p className="text-sm font-semibold text-ink">Payment methods</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Coming soon</span>
            <ChevronRight className="w-4 h-4 text-muted" aria-hidden />
          </div>
        </div>
      </div>

      {/* ── 6. Preferences ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-base text-ink">Preferences</h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-muted shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium text-ink">Notifications</p>
              <p className="text-xs text-muted mt-0.5">Booking updates and alerts</p>
            </div>
          </div>
          <span className="text-xs text-muted">Coming soon</span>
        </div>

        <div className="border-t border-border" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-muted shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium text-ink">Language</p>
              <p className="text-xs text-muted mt-0.5">English</p>
            </div>
          </div>
          <span className="text-xs text-muted">Coming soon</span>
        </div>

        <div className="border-t border-border" />

        <div className="flex items-start gap-3">
          <Smartphone className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink">App install prompt</p>
            <p className="text-xs text-muted mt-0.5">
              {installResetDone
                ? 'Done. The install prompt will appear on your next visit to Home.'
                : 'If you dismissed the install prompt, you can restore it here.'}
            </p>
          </div>
          {!installResetDone && (
            <button
              type="button"
              onClick={() => { clearPwaDismissal(); setInstallResetDone(true); }}
              className="shrink-0 text-xs font-semibold text-copper hover:underline underline-offset-2 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Pause confirmation sheet ────────────────────────────────────────────── */}
      <Sheet open={pauseSheetOpen} onClose={() => setPauseSheetOpen(false)} title="Pause Hosting?">
        <div className="space-y-4">
          <ul className="space-y-2.5 text-sm text-ink">
            <li className="flex items-start gap-2">
              <span className="mt-px text-danger shrink-0">·</span>
              Your chargers will no longer appear in search.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-px text-muted shrink-0">·</span>
              Existing bookings remain active.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-px text-muted shrink-0">·</span>
              Future bookings cannot be made.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-px text-muted shrink-0">·</span>
              Your chargers and settings are preserved.
            </li>
          </ul>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setPauseSheetOpen(false)}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-page transition-colors"
            >
              Keep Hosting
            </button>
            <button
              type="button"
              onClick={() => { void handleConfirmPause(); }}
              className="flex-1 py-3 rounded-xl bg-red-700 text-white text-sm font-semibold hover:bg-red-800 transition-colors"
            >
              Pause Hosting
            </button>
          </div>
        </div>
      </Sheet>

      {/* ── Leave setup confirmation sheet ─────────────────────────────────────── */}
      <Sheet open={leaveSheetOpen} onClose={() => setLeaveSheetOpen(false)} title="Leave hosting setup?">
        <div className="space-y-4">
          <ul className="space-y-2.5 text-sm text-ink">
            <li className="flex items-start gap-2">
              <span className="mt-px text-muted shrink-0">·</span>
              Your progress will be saved.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-px text-muted shrink-0">·</span>
              Your verification (if started) is preserved.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-px text-muted shrink-0">·</span>
              Draft chargers remain saved.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-px text-muted shrink-0">·</span>
              You can continue anytime from Profile.
            </li>
          </ul>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setLeaveSheetOpen(false)}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-page transition-colors"
            >
              Continue Setup
            </button>
            <button
              type="button"
              onClick={() => { void handleLeaveSetup(); }}
              disabled={hostingLoading}
              className="flex-1 py-3 rounded-xl bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              Leave for now
            </button>
          </div>
        </div>
      </Sheet>

      {/* ── Avatar edit sheet ───────────────────────────────────────────────────── */}
      {avatarSheetOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setAvatarSheetOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-5 pt-4 pb-8">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="text-sm font-bold text-ink mb-4 text-center">Profile photo</p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={openCamera}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <Camera className="w-5 h-5 text-muted shrink-0" />
                <span className="text-sm font-semibold text-ink">Take a selfie</span>
              </button>

              <button
                type="button"
                onClick={openFilePicker}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <ImageIcon className="w-5 h-5 text-muted shrink-0" />
                <span className="text-sm font-semibold text-ink">Upload a photo</span>
              </button>

              {kycStatus === 'approved' && (
                <button
                  type="button"
                  onClick={() => { setAvatarSheetOpen(false); void handleResetAvatar(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <ShieldQuestion className="w-5 h-5 text-muted shrink-0" />
                  <span className="text-sm font-semibold text-ink">Use verification photo</span>
                </button>
              )}

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => { setAvatarSheetOpen(false); void handleRemoveAvatar(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50 hover:bg-red-50 transition-colors text-left"
                >
                  <Trash2 className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="text-sm font-semibold text-red-600">Remove photo</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
