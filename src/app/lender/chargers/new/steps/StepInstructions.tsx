'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { NewChargerDraft } from '@/types/charger-draft';

const TITLE_MIN = 5;
const TITLE_MAX = 60;
const INSTRUCTIONS_MIN = 10;
const INSTRUCTIONS_MAX = 500;

interface StepInstructionsProps {
  draft: Partial<NewChargerDraft>;
  onChange: (updates: Partial<NewChargerDraft>) => void;
  onValidChange: (valid: boolean) => void;
}

export function StepInstructions({ draft, onChange, onValidChange }: StepInstructionsProps) {
  const [titleTouched, setTitleTouched] = useState(false);
  const [instrTouched, setInstrTouched] = useState(false);

  const title = draft.title ?? '';
  const instructions = draft.instructions ?? '';

  const titleLen = title.length;
  const instrLen = instructions.length;

  const titleValid = titleLen >= TITLE_MIN && titleLen <= TITLE_MAX;
  const instrValid = instrLen >= INSTRUCTIONS_MIN && instrLen <= INSTRUCTIONS_MAX;
  const valid = titleValid && instrValid;

  useEffect(() => {
    onValidChange(valid);
  }, [valid, onValidChange]);

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.slice(0, TITLE_MAX);
    setTitleTouched(true);
    onChange({ title: value });
  }

  function handleInstrChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value.slice(0, INSTRUCTIONS_MAX);
    setInstrTouched(true);
    onChange({ instructions: value });
  }

  const titleError = titleTouched && !titleValid
    ? titleLen < TITLE_MIN
      ? `At least ${TITLE_MIN} characters required`
      : `Max ${TITLE_MAX} characters`
    : null;

  const instrError = instrTouched && !instrValid
    ? instrLen < INSTRUCTIONS_MIN
      ? `At least ${INSTRUCTIONS_MIN} characters required`
      : `Max ${INSTRUCTIONS_MAX} characters`
    : null;

  return (
    <div>
      <h1 className="font-display font-extrabold text-3xl text-ink">Title & instructions</h1>
      <p className="mt-2 text-base text-muted">
        Help drivers know what to expect.
      </p>

      {/* Title */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="charger-title" className="text-sm font-semibold text-ink">
            Listing title
          </label>
          <span className={cn(
            'text-xs font-semibold tabular-nums',
            titleLen > TITLE_MAX ? 'text-red-500' : 'text-muted',
          )}>
            {titleLen}/{TITLE_MAX}
          </span>
        </div>
        <input
          id="charger-title"
          type="text"
          value={title}
          onChange={handleTitleChange}
          onBlur={() => setTitleTouched(true)}
          placeholder="e.g. Home charger – Saket"
          maxLength={TITLE_MAX}
          className={cn(
            'w-full px-4 py-3.5 bg-gray-100 rounded-2xl text-ink',
            'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt',
            titleError && 'ring-2 ring-red-400 focus:ring-red-400',
          )}
        />
        {titleError && (
          <p className="mt-1.5 text-xs text-red-500 font-semibold">{titleError}</p>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="charger-instructions" className="text-sm font-semibold text-ink">
            Access instructions
          </label>
          <span className={cn(
            'text-xs font-semibold tabular-nums',
            instrLen > INSTRUCTIONS_MAX ? 'text-red-500' : 'text-muted',
          )}>
            {instrLen}/{INSTRUCTIONS_MAX}
          </span>
        </div>
        <textarea
          id="charger-instructions"
          rows={5}
          value={instructions}
          onChange={handleInstrChange}
          onBlur={() => setInstrTouched(true)}
          placeholder="How drivers should access your charger"
          maxLength={INSTRUCTIONS_MAX}
          className={cn(
            'w-full px-4 py-3.5 bg-gray-100 rounded-2xl text-ink resize-none',
            'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt',
            instrError && 'ring-2 ring-red-400 focus:ring-red-400',
          )}
        />
        {instrError && (
          <p className="mt-1.5 text-xs text-red-500 font-semibold">{instrError}</p>
        )}
        <p className="mt-2 text-xs text-muted leading-snug">
          Helpful to mention: gate code, where to park, who to ring, any quirks of the location.
        </p>
      </div>
    </div>
  );
}
