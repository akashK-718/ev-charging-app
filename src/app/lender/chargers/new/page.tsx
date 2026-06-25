'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import type { NewChargerDraft } from '@/types/charger-draft';
import { StepBasics } from './steps/StepBasics';
import { StepPricing } from './steps/StepPricing';
import { StepLocation } from './steps/StepLocation';
import { StepPhotos } from './steps/StepPhotos';
import { StepStub } from './steps/StepStub';

const DRAFT_KEY = 'lender:new-charger:draft';
const TOTAL_STEPS = 7;

const STEP_LABELS: Record<number, string> = {
  1: 'Charger basics',
  2: 'Pricing',
  3: 'Location',
  4: 'Photos',
  5: 'Availability',
  6: 'Access instructions',
  7: 'Review & submit',
};

export default function NewChargerPage() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Partial<NewChargerDraft>>({});
  const [stepValid, setStepValid] = useState(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setDraft(JSON.parse(saved) as Partial<NewChargerDraft>);
    } catch {
      // ignore malformed saved data
    }
  }, []);

  // Skip the first run so we don't overwrite a saved draft before restoration fires
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

  const isActiveStep = step <= 4;
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
        {step >= 5 && <StepStub stepName={STEP_LABELS[step]} />}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex gap-3">
        {step > 1 && (
          <Button
            variant="ghost"
            size="lg"
            className="flex-1"
            onClick={() => setStep(s => s - 1)}
          >
            Back
          </Button>
        )}
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          disabled={(isActiveStep && !stepValid) || isLastStep}
          onClick={() => setStep(s => s + 1)}
        >
          {isLastStep ? 'Submit' : 'Next'}
        </Button>
      </div>
    </main>
  );
}
