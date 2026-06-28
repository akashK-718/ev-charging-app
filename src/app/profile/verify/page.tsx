'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CreditCard, User, Building2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const TOTAL_STEPS = 5;
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const STEP_LABELS: Record<number, string> = {
  1: 'Aadhaar',
  2: 'PAN card',
  3: 'Selfie',
  4: 'Bank / UPI',
  5: 'Review & submit',
};

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

async function uploadToCloudinary(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) throw new Error('Cloudinary is not configured.');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'ev-kyc');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json() as { secure_url: string };
  return data.secure_url;
}

interface PhotoUploaderProps {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (url: string) => void;
  capture?: 'user' | 'environment';
}

function PhotoUploader({ label, hint, value, onChange, capture }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-ink">{label}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}

      {value ? (
        <div className="relative rounded-2xl overflow-hidden border border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full max-h-52 object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center hover:bg-white"
            aria-label="Remove photo"
          >
            <X className="w-4 h-4 text-ink" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'w-full rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50',
            'flex flex-col items-center justify-center gap-2 py-10',
            'hover:border-gray-400 transition-colors disabled:opacity-60',
          )}
        >
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-volt border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted">Uploading…</p>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-muted" />
              <p className="text-sm font-semibold text-ink">Tap to upload</p>
              <p className="text-xs text-muted">JPG or PNG</p>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) { void handleFile(file); }
          e.target.value = '';
        }}
      />

      {uploadError && <p className="text-xs text-red-600 font-semibold">{uploadError}</p>}
    </div>
  );
}

interface KycDraft {
  aadhaar_photo_url: string;
  aadhaar_last_4: string;
  pan_photo_url: string;
  pan_number: string;
  selfie_url: string;
  payment_method: 'bank' | 'upi';
  bank_account_number: string;
  bank_ifsc: string;
  upi_id: string;
}

const EMPTY_DRAFT: KycDraft = {
  aadhaar_photo_url: '',
  aadhaar_last_4: '',
  pan_photo_url: '',
  pan_number: '',
  selfie_url: '',
  payment_method: 'upi',
  bank_account_number: '',
  bank_ifsc: '',
  upi_id: '',
};

function StepAadhaar({ draft, onChange, onValidChange }: { draft: KycDraft; onChange: (u: Partial<KycDraft>) => void; onValidChange: (v: boolean) => void }) {
  const valid = !!draft.aadhaar_photo_url && /^\d{4}$/.test(draft.aadhaar_last_4);
  if (typeof window !== 'undefined') setTimeout(() => onValidChange(valid), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-3xl text-ink">Aadhaar card</h1>
        <p className="mt-2 text-muted">Upload a clear photo of your Aadhaar card.</p>
      </div>
      <PhotoUploader label="Aadhaar photo" hint="Front side showing your name and photo" value={draft.aadhaar_photo_url} onChange={url => onChange({ aadhaar_photo_url: url })} />
      <div className="space-y-1">
        <label className="text-sm font-semibold text-ink" htmlFor="aadhaar_last_4">Last 4 digits of Aadhaar</label>
        <input id="aadhaar_last_4" type="tel" inputMode="numeric" maxLength={4} placeholder="e.g. 1234" value={draft.aadhaar_last_4}
          onChange={e => onChange({ aadhaar_last_4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt" />
        <p className="text-xs text-muted">We only store the last 4 digits for verification.</p>
      </div>
    </div>
  );
}

function StepPan({ draft, onChange, onValidChange }: { draft: KycDraft; onChange: (u: Partial<KycDraft>) => void; onValidChange: (v: boolean) => void }) {
  const panValid = PAN_REGEX.test(draft.pan_number);
  const valid = !!draft.pan_photo_url && panValid;
  if (typeof window !== 'undefined') setTimeout(() => onValidChange(valid), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-3xl text-ink">PAN card</h1>
        <p className="mt-2 text-muted">Upload your PAN card and enter the PAN number.</p>
      </div>
      <PhotoUploader label="PAN card photo" hint="Clear photo showing the PAN number" value={draft.pan_photo_url} onChange={url => onChange({ pan_photo_url: url })} />
      <div className="space-y-1">
        <label className="text-sm font-semibold text-ink" htmlFor="pan_number">PAN number</label>
        <input id="pan_number" type="text" inputMode="text" maxLength={10} placeholder="ABCDE1234F" value={draft.pan_number}
          onChange={e => onChange({ pan_number: e.target.value.toUpperCase().trim() })}
          className={cn(
            'w-full rounded-2xl border px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt font-mono tracking-widest',
            draft.pan_number.length > 0 && !panValid ? 'border-red-300' : 'border-gray-200',
          )} />
        {draft.pan_number.length > 0 && !panValid && (
          <p className="text-xs text-red-600">Format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)</p>
        )}
      </div>
    </div>
  );
}

function StepSelfie({ draft, onChange, onValidChange }: { draft: KycDraft; onChange: (u: Partial<KycDraft>) => void; onValidChange: (v: boolean) => void }) {
  const valid = !!draft.selfie_url;
  if (typeof window !== 'undefined') setTimeout(() => onValidChange(valid), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-3xl text-ink">Take a selfie</h1>
        <p className="mt-2 text-muted">A clear photo of your face for identity verification.</p>
      </div>
      <div className="px-4 py-3 bg-volt-soft rounded-2xl text-sm text-ink">
        <p className="font-semibold mb-1">Tips for a good selfie:</p>
        <ul className="text-muted space-y-0.5 list-disc list-inside">
          <li>Good lighting, face clearly visible</li>
          <li>No sunglasses or hat</li>
          <li>Look directly at the camera</li>
        </ul>
      </div>
      <PhotoUploader label="Your selfie" hint="Use the front camera" value={draft.selfie_url} onChange={url => onChange({ selfie_url: url })} capture="user" />
    </div>
  );
}

function StepBankUpi({ draft, onChange, onValidChange }: { draft: KycDraft; onChange: (u: Partial<KycDraft>) => void; onValidChange: (v: boolean) => void }) {
  const valid = draft.payment_method === 'bank'
    ? draft.bank_account_number.trim().length > 5 && draft.bank_ifsc.trim().length === 11
    : draft.upi_id.trim().length > 3;
  if (typeof window !== 'undefined') setTimeout(() => onValidChange(valid), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-3xl text-ink">Payout details</h1>
        <p className="mt-2 text-muted">Choose how you want to receive your earnings.</p>
      </div>
      <div className="flex rounded-2xl overflow-hidden border border-gray-200">
        <button type="button" onClick={() => onChange({ payment_method: 'bank' })}
          className={cn('flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors',
            draft.payment_method === 'bank' ? 'bg-ink text-white' : 'bg-white text-muted hover:text-ink')}>
          <Building2 className="w-4 h-4" /> Bank account
        </button>
        <button type="button" onClick={() => onChange({ payment_method: 'upi' })}
          className={cn('flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors',
            draft.payment_method === 'upi' ? 'bg-ink text-white' : 'bg-white text-muted hover:text-ink')}>
          <CreditCard className="w-4 h-4" /> UPI
        </button>
      </div>
      {draft.payment_method === 'bank' ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink" htmlFor="bank_acc">Account number</label>
            <input id="bank_acc" type="tel" inputMode="numeric" placeholder="Enter account number" value={draft.bank_account_number}
              onChange={e => onChange({ bank_account_number: e.target.value.replace(/\D/g, '') })}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink" htmlFor="bank_ifsc">IFSC code</label>
            <input id="bank_ifsc" type="text" maxLength={11} placeholder="e.g. SBIN0001234" value={draft.bank_ifsc}
              onChange={e => onChange({ bank_ifsc: e.target.value.toUpperCase() })}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt font-mono" />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-sm font-semibold text-ink" htmlFor="upi_id">UPI ID</label>
          <input id="upi_id" type="text" placeholder="yourname@upi" value={draft.upi_id}
            onChange={e => onChange({ upi_id: e.target.value.trim() })}
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt" />
        </div>
      )}
    </div>
  );
}

function ReviewSection({ icon, label, onEdit, children }: { icon: React.ReactNode; label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-ink font-semibold text-sm">{icon}{label}</div>
        <button type="button" onClick={onEdit} className="text-xs font-semibold text-volt-deep hover:underline">Edit</button>
      </div>
      {children}
    </div>
  );
}

function StepReview({ draft, onEditStep, onValidChange }: { draft: KycDraft; onEditStep: (s: number) => void; onValidChange: (v: boolean) => void }) {
  if (typeof window !== 'undefined') setTimeout(() => onValidChange(true), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-3xl text-ink">Review & submit</h1>
        <p className="mt-2 text-muted">Check everything before submitting.</p>
      </div>
      <div className="space-y-3">
        <ReviewSection icon={<User className="w-4 h-4" />} label="Aadhaar" onEdit={() => onEditStep(1)}>
          <p className="text-sm text-muted">Last 4 digits: ****{draft.aadhaar_last_4}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.aadhaar_photo_url} alt="Aadhaar" className="mt-2 w-32 rounded-xl object-cover" />
        </ReviewSection>
        <ReviewSection icon={<CreditCard className="w-4 h-4" />} label="PAN card" onEdit={() => onEditStep(2)}>
          <p className="text-sm text-muted font-mono tracking-widest">{draft.pan_number}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.pan_photo_url} alt="PAN" className="mt-2 w-32 rounded-xl object-cover" />
        </ReviewSection>
        <ReviewSection icon={<Camera className="w-4 h-4" />} label="Selfie" onEdit={() => onEditStep(3)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.selfie_url} alt="Selfie" className="w-20 rounded-xl object-cover" />
        </ReviewSection>
        <ReviewSection icon={<Building2 className="w-4 h-4" />} label="Payout" onEdit={() => onEditStep(4)}>
          {draft.payment_method === 'bank' ? (
            <div className="text-sm text-muted space-y-0.5">
              <p>Account: ••••{draft.bank_account_number.slice(-4)}</p>
              <p>IFSC: {draft.bank_ifsc}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">{draft.upi_id}</p>
          )}
        </ReviewSection>
      </div>
      <div className="px-4 py-3 bg-yellow-50 rounded-2xl text-sm text-yellow-700">
        By submitting, you confirm the documents are genuine. Fake documents will result in permanent account suspension.
      </div>
    </div>
  );
}

export default function ProfileVerifyPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<KycDraft>(EMPTY_DRAFT);
  const [stepValid, setStepValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateDraft(updates: Partial<KycDraft>) {
    setDraft(prev => ({ ...prev, ...updates }));
  }

  function goToStep(s: number) {
    setStepValid(false);
    setStep(s);
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      aadhaar_photo_url: draft.aadhaar_photo_url,
      pan_photo_url: draft.pan_photo_url,
      selfie_url: draft.selfie_url,
      pan_number: draft.pan_number,
      aadhaar_last_4: draft.aadhaar_last_4,
      ...(draft.payment_method === 'bank'
        ? { bank_account_number: draft.bank_account_number, bank_ifsc: draft.bank_ifsc }
        : { upi_id: draft.upi_id }),
    };

    try {
      const res = await fetch('/api/lender/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setSubmitError(body.error ?? 'Submission failed. Please try again.');
        return;
      }

      router.push('/profile?verified=submitted');
    } catch {
      setSubmitError('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLastStep = step === TOTAL_STEPS;

  return (
    <main className="min-h-screen flex flex-col px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">
            Step {step} of {TOTAL_STEPS}
          </span>
          <span className="text-xs text-muted">{STEP_LABELS[step]}</span>
        </div>
        <div className="h-1.5 bg-volt-soft rounded-full overflow-hidden">
          <div
            className="h-full bg-volt rounded-full transition-[width] duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1">
        {step === 1 && <StepAadhaar draft={draft} onChange={updateDraft} onValidChange={setStepValid} />}
        {step === 2 && <StepPan draft={draft} onChange={updateDraft} onValidChange={setStepValid} />}
        {step === 3 && <StepSelfie draft={draft} onChange={updateDraft} onValidChange={setStepValid} />}
        {step === 4 && <StepBankUpi draft={draft} onChange={updateDraft} onValidChange={setStepValid} />}
        {step === 5 && <StepReview draft={draft} onEditStep={goToStep} onValidChange={setStepValid} />}
      </div>

      {submitError && (
        <p className="mt-4 px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {submitError}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        {step > 1 && (
          <Button variant="ghost" size="lg" className="flex-1" disabled={isSubmitting} onClick={() => goToStep(step - 1)}>
            Back
          </Button>
        )}
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          disabled={!stepValid || isSubmitting}
          onClick={isLastStep ? () => { void handleSubmit(); } : () => goToStep(step + 1)}
        >
          {isLastStep ? (isSubmitting ? 'Submitting…' : 'Submit for verification') : 'Next'}
        </Button>
      </div>
    </main>
  );
}
