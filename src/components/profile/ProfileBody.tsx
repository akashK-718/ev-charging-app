'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil, ShieldCheck, ShieldX, Clock, ShieldAlert,
  Camera, ImageIcon, ShieldQuestion, Trash2,
  Smartphone, Home, Car, CreditCard,
  ChevronRight, Bell, LayoutDashboard, TrendingUp,
  PauseCircle, Star, HelpCircle, LogOut, Plug,
} from 'lucide-react';
import { NameEditor } from './NameEditor';
import { ProfileMenuDrawer } from './ProfileMenuDrawer';
import { Avatar } from '@/components/ui/Avatar';
import { Sheet } from '@/components/ui/Sheet';
import { uploadImage } from '@/lib/cloudinary';
import { ImageCropper } from '@/components/ui/ImageCropper';
import { clearPwaDismissal } from '@/lib/pwa';
import { cn } from '@/lib/utils';

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
  isAdmin: boolean;
  initialName: string | null;
  phone: string;
  hostingState: HostingState;
  chargerStats: ChargerStats;
  createdAt: string;
  kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected';
  submission: Submission | null;
  showSubmittedBanner: boolean;
  initialAvatarUrl: string | null;
  lifetimeEarningsPaise: number;
  activePricePerKwh: number | null;
  avgRating: number | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

function SectionLabel({
  children,
  badge,
}: {
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{children}</p>
      {badge}
    </div>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  href,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-page transition-colors">
      <div className={cn(
        'size-9 rounded-2xl grid place-items-center shrink-0',
        danger ? 'bg-danger-soft text-danger' : 'bg-surface-page text-muted',
      )}>
        {icon}
      </div>
      <span className={cn('flex-1 text-sm font-medium', danger ? 'text-danger' : 'text-ink')}>
        {label}
      </span>
      {value && <span className="text-xs text-muted">{value}</span>}
      <ChevronRight className={cn('size-4 shrink-0', danger ? 'text-danger/50' : 'text-muted')} />
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>;
  return <div className="opacity-50">{inner}</div>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProfileBody({
  isAdmin,
  initialName,
  // phone retained for future use
  phone: _phone,
  hostingState: initialHostingState,
  chargerStats,
  createdAt,
  kycStatus,
  submission,
  showSubmittedBanner,
  initialAvatarUrl,
  lifetimeEarningsPaise,
  activePricePerKwh,
  avgRating,
}: ProfileBodyProps) {
  const router = useRouter();

  // ── Avatar state ──────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Hosting state ──────────────────────────────────────────────────────────────
  const [hostingState, setHostingState] = useState<HostingState>(initialHostingState);
  const [pauseSheetOpen, setPauseSheetOpen] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [hostingLoading, setHostingLoading] = useState(false);
  const [hostingError, setHostingError] = useState<string | null>(null);

  // ── Display name (reactive header) ───────────────────────────────────────────
  const [displayName, setDisplayName] = useState<string | null>(initialName);

  // ── Preferences state ─────────────────────────────────────────────────────────
  const [installResetDone, setInstallResetDone] = useState(false);

  const hostingStarted = hostingState !== 'not_enabled';

  const setupContinueHref = kycStatus === 'approved'
    ? '/lender/chargers/new?from=onboarding'
    : '/profile/verify?from=onboarding';

  // ── Avatar handlers ────────────────────────────────────────────────────────────

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

  // ── Hosting handlers ───────────────────────────────────────────────────────────

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

      <div className="pb-8">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="px-4 pt-6 pb-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setAvatarSheetOpen(true)}
            aria-label="Edit profile photo"
            className="relative shrink-0"
          >
            {avatarLoading ? (
              <div className="size-[72px] rounded-full bg-surface-page animate-pulse" />
            ) : (
              <Avatar avatarUrl={avatarUrl} name={displayName} size="xl" />
            )}
            <span className="absolute bottom-0.5 right-0.5 size-5 bg-ink text-white rounded-full grid place-items-center shadow-md">
              <Pencil className="size-2.5" />
            </span>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-ink truncate">{displayName ?? 'Your name'}</h1>
            <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
              <Car className="size-3 shrink-0" />
              <span>No vehicle added</span>
            </p>
            <p className="text-xs text-muted mt-0.5">Member since {formatDate(createdAt)}</p>
          </div>

          <ProfileMenuDrawer isAdmin={isAdmin} />
        </div>

        {avatarError && (
          <p className="mx-4 -mt-2 mb-3 text-xs text-danger font-medium">{avatarError}</p>
        )}

        {/* ── Submitted banner ─────────────────────────────────────────────────── */}
        {showSubmittedBanner && hostingStarted && kycStatus === 'pending' && (
          <div className="mx-4 mb-4 px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
            <p className="font-semibold text-blue-800">Verification submitted!</p>
            <p className="text-sm text-blue-700 mt-0.5">We&apos;ll review your documents within 24–48 hours.</p>
          </div>
        )}

        {/* ── Hosting ─────────────────────────────────────────────────────────── */}
        <div className="px-4">

          {/* not_enabled: promo gradient card, no section title */}
          {hostingState === 'not_enabled' && (
            <div>
              <button
                type="button"
                onClick={() => { void handleStartHosting(); }}
                disabled={hostingLoading}
                className="rise-in w-full rounded-3xl p-5 text-white shadow-lg active:scale-[0.98] transition text-left disabled:opacity-75"
                style={{ background: 'linear-gradient(135deg,#14532d,#16a34a)' }}
              >
                <Home className="size-6 mb-2.5" />
                <p className="font-bold">Have a home charger?</p>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Turn on hosting and earn when your neighbours charge at your place.
                </p>
                <span className="inline-block mt-3 h-9 px-4 leading-9 rounded-full bg-white text-green-800 text-xs font-bold pointer-events-none">
                  {hostingLoading ? 'Starting…' : 'Turn on hosting'}
                </span>
              </button>
              {hostingError && <p className="text-xs text-danger font-medium mt-2 px-1">{hostingError}</p>}
            </div>
          )}

          {/* setup_in_progress: section title + gradient card + Not now link */}
          {hostingState === 'setup_in_progress' && (
            <div>
              <SectionLabel>Hosting</SectionLabel>
              <div
                className="rounded-3xl p-5 text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg,#14532d,#16a34a)' }}
              >
                <Home className="size-6 mb-2.5" />
                <p className="font-bold">Setup in progress</p>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Verify your identity and list your first charger.
                </p>
                <Link
                  href={setupContinueHref}
                  className="inline-block mt-3 h-9 px-4 leading-9 rounded-full bg-white text-green-800 text-xs font-bold"
                >
                  Continue
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setLeaveSheetOpen(true)}
                className="mt-2 text-xs text-muted hover:text-ink transition-colors px-1"
              >
                Not now
              </button>
            </div>
          )}

          {/* setup_deferred: section title + gradient card + Resume pill */}
          {hostingState === 'setup_deferred' && (
            <div>
              <SectionLabel>Hosting</SectionLabel>
              <div
                className="rounded-3xl p-5 text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg,#14532d,#16a34a)' }}
              >
                <Home className="size-6 mb-2.5" />
                <p className="font-bold">Resume your setup</p>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Finish verification and list your first charger to start earning.
                </p>
                <button
                  type="button"
                  onClick={handleResumeSetup}
                  className="inline-block mt-3 h-9 px-4 leading-9 rounded-full bg-white text-green-800 text-xs font-bold"
                >
                  Resume
                </button>
              </div>
            </div>
          )}

          {/* active / paused: section title + HOSTING ON badge (active only) + dark dashboard card + white rows */}
          {(hostingState === 'active' || hostingState === 'paused') && (
            <div>
              <SectionLabel badge={
                hostingState === 'active' ? (
                  <span className="text-[10px] font-bold text-green bg-green-soft rounded-full px-2 py-0.5 uppercase tracking-wide">
                    Hosting on
                  </span>
                ) : undefined
              }>
                Hosting
              </SectionLabel>

              <Link
                href="/lender/chargers"
                className="block bg-zinc-900 text-white rounded-3xl p-4 shadow-lg active:scale-[0.98] transition"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-green-400 flex items-center gap-1.5">
                    <LayoutDashboard className="size-3.5" />
                    Host dashboard
                  </p>
                  <TrendingUp className="size-4 text-white/50" />
                </div>
                <p className="mt-2 text-2xl font-bold">
                  ₹{Math.round(lifetimeEarningsPaise / 100).toLocaleString('en-IN')}
                  {' '}<span className="text-xs font-normal text-white/50">earned all time</span>
                </p>
                <p className="text-[11px] text-white/60 mt-1">
                  Bookings, payouts and your listing — managed in one place.
                </p>
              </Link>

              <div className="mt-3 bg-white border border-border rounded-3xl shadow-sm overflow-hidden divide-y divide-border">
                <ProfileRow
                  icon={<Plug className="size-4" />}
                  label="My charger"
                  value={activePricePerKwh != null ? `₹${activePricePerKwh}/kWh` : '—'}
                  href="/lender/chargers"
                />
                {hostingState === 'active' ? (
                  <ProfileRow
                    icon={<PauseCircle className="size-4" />}
                    label="Pause listing"
                    value="Vacation / repairs"
                    onClick={() => setPauseSheetOpen(true)}
                  />
                ) : (
                  <ProfileRow
                    icon={<PauseCircle className="size-4" />}
                    label="Resume listing"
                    value="Currently hidden"
                    onClick={() => { void handleResume(); }}
                  />
                )}
              </div>

              {hostingError && <p className="text-xs text-danger font-medium mt-2 px-1">{hostingError}</p>}
            </div>
          )}
        </div>

        {/* ── Identity verification (shown when hosting is started) ────────────── */}
        {hostingStarted && (
          <div className="px-4 mt-6">
            <SectionLabel>Identity verification</SectionLabel>
            <div className="bg-white border border-border rounded-3xl shadow-sm overflow-hidden p-4 space-y-3">

              {kycStatus === 'not_started' && (
                <div className="space-y-3">
                  <div className="flex gap-3 p-4 rounded-2xl border bg-yellow-50 border-yellow-200">
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
                    className="block w-full text-center px-4 py-3 bg-ink text-white text-sm font-bold rounded-2xl hover:bg-ink/90 transition-colors"
                  >
                    Start verification
                  </Link>
                </div>
              )}

              {kycStatus === 'pending' && submission && (
                <div className="flex gap-3 p-4 rounded-2xl border bg-blue-50 border-blue-200">
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
                <div className="flex gap-3 p-4 rounded-2xl border bg-green-50 border-green-200">
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
                <div className="space-y-3">
                  <div className="flex gap-3 p-4 rounded-2xl border bg-red-50 border-red-200">
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
                    className="block w-full text-center px-4 py-3 bg-red-700 text-white text-sm font-bold rounded-2xl hover:bg-red-800 transition-colors"
                  >
                    Resubmit documents
                  </Link>
                </div>
              )}

              <p className="text-xs text-muted">
                We collect Aadhaar and PAN for identity verification as required by Indian payment
                regulations. Documents are reviewed by our team and not shared with third parties.
              </p>
            </div>
          </div>
        )}

        {/* ── Account ─────────────────────────────────────────────────────────── */}
        <div className="px-4 mt-6">
          <SectionLabel>Account</SectionLabel>
          <div className="bg-white border border-border rounded-3xl shadow-sm overflow-hidden divide-y divide-border">

            {/* Name editor as first row */}
            <div className="px-4 py-3.5">
              <NameEditor
                initialName={initialName}
                showKycContext={hostingStarted}
                onNameChange={setDisplayName}
              />
            </div>

            <ProfileRow
              icon={<CreditCard className="size-4" />}
              label="Payment methods"
              value="Coming soon"
            />
            <ProfileRow
              icon={<Car className="size-4" />}
              label="My vehicle"
              value="Coming soon"
            />
            <ProfileRow
              icon={<Bell className="size-4" />}
              label="Notifications"
              value="Coming soon"
            />
            <ProfileRow
              icon={<Star className="size-4" />}
              label="My reviews"
              value={avgRating != null ? `${avgRating.toFixed(1)} as a guest` : 'No reviews yet'}
            />
            <ProfileRow
              icon={<HelpCircle className="size-4" />}
              label="Help & support"
              href="/help"
            />

            {/* App install prompt */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-2xl bg-surface-page grid place-items-center shrink-0 text-muted">
                  <Smartphone className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">App install prompt</p>
                  <p className="text-xs text-muted">
                    {installResetDone ? 'Will appear on next Home visit' : 'Restore if dismissed'}
                  </p>
                </div>
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

            {hostingState === 'active' && (
              <ProfileRow
                icon={<LogOut className="size-4" />}
                label="Stop hosting"
                value="Keeps your setup"
                onClick={() => setPauseSheetOpen(true)}
                danger
              />
            )}
          </div>
        </div>

        {/* ── Footer tagline ───────────────────────────────────────────────────── */}
        <p className="text-center text-[10px] text-muted mt-6 leading-relaxed px-8">
          One account for everything — charging always works.<br />
          Hosting is just a section that appears when you turn it on.
        </p>

      </div>

      {/* ── Pause confirmation sheet ──────────────────────────────────────────── */}
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

      {/* ── Leave setup confirmation sheet ───────────────────────────────────── */}
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

      {/* ── Avatar edit sheet ─────────────────────────────────────────────────── */}
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
