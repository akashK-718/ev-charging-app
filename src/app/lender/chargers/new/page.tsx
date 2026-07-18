'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { haptic } from '@/lib/haptics';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import type { NewChargerDraft } from '@/types/charger-draft';
import { StepBasics } from './steps/StepBasics';
import { StepPricing } from './steps/StepPricing';
import { StepLocation } from './steps/StepLocation';
import { StepPhotos } from './steps/StepPhotos';
import { StepAvailability } from './steps/StepAvailability';
import { StepInstructions } from './steps/StepInstructions';
import { StepReview } from './steps/StepReview';

const DRAFT_KEY = 'lender:new-charger:draft';
const TOTAL_STEPS = 7;

const STEP_LABELS: Record<number, string> = {
  1: 'Charger basics',
  2: 'Pricing',
  3: 'Location',
  4: 'Photos',
  5: 'Availability',
  6: 'Title & instructions',
  7: 'Review & submit',
};

function NewChargerPageContent({ isOnboarding }: { isOnboarding: boolean }) {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Partial<NewChargerDraft>>({});
  const [stepValid, setStepValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setDraft(JSON.parse(saved) as Partial<NewChargerDraft>);
    } catch {
      // ignore malformed saved data
    }
  }, []);

  // Skip the first render so we don't overwrite a saved draft before restoration fires
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  function updateDraft(updates: Partial<NewChargerDraft>) {
    setDraft(prev => ({ ...prev, ...updates }));
  }

  function goToStep(s: number) {
    setStepValid(false); // let the incoming step re-report its own validity
    setStep(s);
  }

  async function handleDeleteDraft() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/profile/cancel-hosting-setup', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setDeleteError(data.error ?? 'Could not delete draft. Please try again.');
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      router.push('/profile');
    } catch {
      setDeleteError('Could not delete draft. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      title: draft.title,
      chargerType: draft.chargerType,
      connectorTypes: draft.connectorTypes,
      pricePerKwh: draft.pricePerKwh,
      address: draft.address,
      latitude: draft.latitude,
      longitude: draft.longitude,
      photos: draft.photos,
      instructions: draft.instructions,
      availability: (draft.availability ?? []).map(slot => ({
        daysOfWeek: [slot.day_of_week],
        startTime: slot.start_time,
        endTime: slot.end_time,
      })),
    };

    try {
      const res = await fetch('/api/chargers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setSubmitError(body.error ?? "Couldn't save charger, please try again.");
        return;
      }

      localStorage.removeItem(DRAFT_KEY);
      haptic('light');
      router.push('/lender/dashboard?listed=1');
    } catch {
      setSubmitError("Couldn't save charger, please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLastStep = step === TOTAL_STEPS;

  return (
    <main className="min-h-screen flex flex-col px-6 py-10">
      <Sheet open={deleteSheetOpen} onClose={() => setDeleteSheetOpen(false)} title="Delete this draft?">
        <div className="space-y-4">
          <p className="text-sm text-ink">Photos, pricing and availability will be permanently removed.</p>
          {deleteError && (
            <p className="text-xs text-red-600 font-medium">{deleteError}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setDeleteSheetOpen(false)}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-page transition-colors"
            >
              Keep Draft
            </button>
            <button
              type="button"
              onClick={() => { void handleDeleteDraft(); }}
              disabled={isDeleting}
              className="flex-1 py-3 rounded-xl bg-red-700 text-white text-sm font-semibold hover:bg-red-800 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting…' : 'Delete Draft'}
            </button>
          </div>
        </div>
      </Sheet>

      {/* Progress */}
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

      {/* Step content */}
      <div className="flex-1">
        {step === 1 && (
          <StepBasics draft={draft} onChange={updateDraft} onValidChange={setStepValid} />
        )}
        {step === 2 && (
          <StepPricing draft={draft} onChange={updateDraft} onValidChange={setStepValid} />
        )}
        {step === 3 && (
          <StepLocation draft={draft} onChange={updateDraft} onValidChange={setStepValid} />
        )}
        {step === 4 && (
          <StepPhotos draft={draft} onChange={updateDraft} onValidChange={setStepValid} />
        )}
        {step === 5 && (
          <StepAvailability draft={draft} onChange={updateDraft} onValidChange={setStepValid} />
        )}
        {step === 6 && (
          <StepInstructions draft={draft} onChange={updateDraft} onValidChange={setStepValid} />
        )}
        {step === 7 && (
          <StepReview draft={draft} onEditStep={goToStep} onValidChange={setStepValid} />
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <p className="mt-4 px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600 font-semibold">
          {submitError}
        </p>
      )}

      {/* Navigation */}
      <div className="mt-8 flex gap-3">
        {step > 1 && (
          <Button
            variant="ghost"
            size="lg"
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => goToStep(step - 1)}
          >
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
          {isLastStep
            ? (isSubmitting ? 'Listing…' : 'List my charger')
            : 'Next'}
        </Button>
      </div>

      {isOnboarding && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setDeleteSheetOpen(true)}
            className="text-xs text-muted hover:text-danger transition-colors"
          >
            Delete draft
          </button>
        </div>
      )}
    </main>
  );
}

function NewChargerPageWrapper() {
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get('from') === 'onboarding';
  return <NewChargerPageContent isOnboarding={isOnboarding} />;
}

export default function NewChargerPage() {
  return (
    <Suspense fallback={null}>
      <NewChargerPageWrapper />
    </Suspense>
  );
}
