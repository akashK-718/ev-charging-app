'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { NewChargerDraft } from '@/types/charger-draft';
import { StepBasics } from '../../new/steps/StepBasics';
import { StepPricing } from '../../new/steps/StepPricing';
import { StepLocation } from '../../new/steps/StepLocation';
import { StepPhotos } from '../../new/steps/StepPhotos';
import { StepAvailability } from '../../new/steps/StepAvailability';
import { StepInstructions } from '../../new/steps/StepInstructions';
import { StepReview } from '../../new/steps/StepReview';

const TOTAL_STEPS = 7;

const STEP_LABELS: Record<number, string> = {
  1: 'Charger basics',
  2: 'Pricing',
  3: 'Location',
  4: 'Photos',
  5: 'Availability',
  6: 'Title & instructions',
  7: 'Review & update',
};

type RawCharger = {
  id: string;
  title: string;
  charger_type: string;
  connector_types: string[];
  price_per_kwh: number;
  address: string;
  latitude: number;
  longitude: number;
  photos: string[];
  instructions: string | null;
};

type AvailabilitySlot = {
  day_of_week: number[];
  start_time: string;
  end_time: string;
};

export default function EditChargerPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const chargerId = params.id;

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Partial<NewChargerDraft>>({});
  const [stepValid, setStepValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitialized = useRef(false);

  // Load existing charger data and pre-fill draft
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    async function loadCharger() {
      try {
        // Fetch from lender chargers endpoint
        const res = await fetch('/api/lender/chargers');
        if (!res.ok) { setLoadError('Failed to load charger'); setLoading(false); return; }
        const body = await res.json() as { data: RawCharger[] };
        const charger = body.data.find(c => c.id === chargerId);
        if (!charger) { setLoadError('Charger not found'); setLoading(false); return; }

        // Fetch availability slots
        const slotsRes = await fetch(`/api/chargers/${chargerId}/slots`);
        let availability: NewChargerDraft['availability'] = [];
        if (slotsRes.ok) {
          const slotsBody = await slotsRes.json() as { data: AvailabilitySlot[] };
          availability = (slotsBody.data ?? []).map((s: AvailabilitySlot) => ({
            day_of_week: s.day_of_week[0] ?? 0,
            start_time: s.start_time,
            end_time: s.end_time,
          }));
        }

        setDraft({
          chargerType: charger.charger_type as NewChargerDraft['chargerType'],
          connectorTypes: charger.connector_types as NewChargerDraft['connectorTypes'],
          pricePerKwh: charger.price_per_kwh,
          address: charger.address,
          latitude: charger.latitude,
          longitude: charger.longitude,
          photos: charger.photos,
          instructions: charger.instructions ?? '',
          title: charger.title,
          availability,
        });
      } catch {
        setLoadError('Failed to load charger');
      } finally {
        setLoading(false);
      }
    }

    void loadCharger();
  }, [chargerId]);

  function updateDraft(updates: Partial<NewChargerDraft>) {
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

    const payload: Record<string, unknown> = {};
    if (draft.title) payload.title = draft.title;
    if (draft.chargerType) payload.chargerType = draft.chargerType;
    if (draft.connectorTypes) payload.connectorTypes = draft.connectorTypes;
    if (draft.pricePerKwh != null) payload.pricePerKwh = draft.pricePerKwh;
    if (draft.address) payload.address = draft.address;
    if (draft.latitude != null) payload.latitude = draft.latitude;
    if (draft.longitude != null) payload.longitude = draft.longitude;
    if (draft.photos) payload.photos = draft.photos;
    if (draft.instructions) payload.instructions = draft.instructions;

    try {
      const res = await fetch(`/api/chargers/${chargerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setSubmitError(body.error ?? "Couldn't update charger, please try again.");
        return;
      }

      router.push('/lender/chargers?updated=1');
    } catch {
      setSubmitError("Couldn't update charger, please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted">Loading charger…</div>;
  }

  if (loadError) {
    return (
      <main className="px-6 py-10">
        <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600 font-semibold">
          {loadError}
        </div>
      </main>
    );
  }

  const isLastStep = step === TOTAL_STEPS;

  return (
    <main className="min-h-screen flex flex-col px-6 py-10">
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

      {/* Editing banner */}
      <div className="mb-4 px-3 py-2 bg-blue-50 rounded-xl text-xs font-semibold text-blue-700">
        Editing existing charger
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
            ? isSubmitting
              ? 'Saving…'
              : 'Save changes'
            : 'Next'}
        </Button>
      </div>
    </main>
  );
}
