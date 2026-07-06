'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Pencil, ShieldCheck, ShieldX, Clock, ShieldAlert, Camera, ImageIcon, ShieldQuestion, Trash2 } from 'lucide-react';
import { NameEditor } from './NameEditor';
import { RoleEditor } from './RoleEditor';
import { Avatar } from '@/components/ui/Avatar';
import { uploadImage } from '@/lib/cloudinary';
import { requiresKyc, type UserRole } from '@/lib/auth/kyc';

type Role = 'driver' | 'lender' | 'both';

interface Submission {
  id: string;
  status: string;
  submitted_at: string;
  rejection_reason: string | null;
}

interface ProfileBodyProps {
  initialName: string | null;
  phone: string;
  initialRole: Role;
  createdAt: string;
  kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected';
  submission: Submission | null;
  draftCount: number;
  showSubmittedBanner: boolean;
  initialAvatarUrl: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function resizeImage(file: File, maxSize = 400): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No 2d context')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.9,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

export function ProfileBody({
  initialName,
  phone,
  initialRole,
  createdAt,
  kycStatus,
  submission,
  draftCount,
  showSubmittedBanner,
  initialAvatarUrl,
}: ProfileBodyProps) {
  const [role, setRole] = useState<Role>(initialRole);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const kycRequired = requiresKyc(role as UserRole);

  async function handleFileSelect(file: File) {
    setAvatarLoading(true);
    setAvatarError(null);
    try {
      const resized = await resizeImage(file, 400);
      const url = await uploadImage(resized);
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
    setSheetOpen(false);
    setTimeout(() => cameraInputRef.current?.click(), 50);
  }

  function openFilePicker() {
    setSheetOpen(false);
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleFileSelect(f);
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
          if (f) void handleFileSelect(f);
          e.target.value = '';
        }}
      />

      {/* Submission success toast */}
      {showSubmittedBanner && kycRequired && kycStatus === 'pending' && (
        <div className="px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
          <p className="font-semibold text-blue-800">Verification submitted!</p>
          <p className="text-sm text-blue-700 mt-0.5">We&apos;ll review your documents within 24–48 hours.</p>
        </div>
      )}

      {/* Account info */}
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
              onClick={() => setSheetOpen(true)}
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
          <NameEditor initialName={initialName} showKycContext={kycRequired} />
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
          <RoleEditor initialRole={role} onRoleChange={setRole} />
          <div>
            <p className="text-xs text-muted mb-0.5">Member since</p>
            <p className="text-sm font-semibold text-ink">{formatDate(createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Identity verification */}
      {kycRequired && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-base text-ink">Identity verification</h2>

          {kycStatus === 'not_started' && (
            <div className="space-y-4">
              <div className="flex gap-3 p-4 rounded-xl border bg-yellow-50 border-yellow-200">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600" />
                <div>
                  <p className="font-semibold text-sm text-yellow-700">Not verified</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {draftCount > 0
                      ? `You have ${draftCount} charger${draftCount > 1 ? 's' : ''} awaiting publish. Verify your identity to make them visible to drivers.`
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
                  {draftCount > 0 && ` Your ${draftCount} charger${draftCount > 1 ? 's' : ''} will go live automatically once approved.`}
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

      {/* Avatar edit bottom sheet */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSheetOpen(false)}
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
                  onClick={() => { setSheetOpen(false); void handleResetAvatar(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <ShieldQuestion className="w-5 h-5 text-muted shrink-0" />
                  <span className="text-sm font-semibold text-ink">Use verification photo</span>
                </button>
              )}

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => { setSheetOpen(false); void handleRemoveAvatar(); }}
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
