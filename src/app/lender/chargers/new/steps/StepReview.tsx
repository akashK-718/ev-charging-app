'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { PLATFORM_COMMISSION_PERCENT } from '@/lib/constants';
import type { NewChargerDraft } from '@/types/charger-draft';

const mapsApiConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

const LocationMapPreview = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => <div className="h-[160px] bg-gray-100 rounded-2xl animate-pulse" />,
});

const DAY_LABELS: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

const CHARGER_LABELS: Record<string, string> = {
  'AC_3.3kW': '3.3 kW AC',
  'AC_7kW': '7 kW AC',
  'AC_22kW': '22 kW AC',
  'DC_fast': 'DC Fast',
};

const CONNECTOR_LABELS: Record<string, string> = {
  Type2: 'Type 2',
  BharatAC: 'Bharat AC',
  CCS2: 'CCS2',
  CHAdeMO: 'CHAdeMO',
  Type1: 'Type 1',
};

interface StepReviewProps {
  draft: Partial<NewChargerDraft>;
  onEditStep: (step: number) => void;
  onValidChange: (valid: boolean) => void;
}

function SectionHeader({
  label,
  step,
  onEdit,
}: {
  label: string;
  step: number;
  onEdit: (s: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs font-bold text-muted uppercase tracking-wide">{label}</p>
      <button
        type="button"
        onClick={() => onEdit(step)}
        className="text-xs font-semibold text-volt-deep underline underline-offset-2"
      >
        Edit
      </button>
    </div>
  );
}

export function StepReview({ draft, onEditStep, onValidChange }: StepReviewProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    onValidChange(termsAccepted);
  }, [termsAccepted, onValidChange]);

  const estimatedEarnings =
    draft.pricePerKwh != null
      ? Math.round(draft.pricePerKwh * 10 * (1 - PLATFORM_COMMISSION_PERCENT / 100))
      : null;

  return (
    <div>
      <h1 className="font-display font-extrabold text-3xl text-ink">Review & submit</h1>
      <p className="mt-2 text-base text-muted">Check everything before going live.</p>

      <div className="mt-8 flex flex-col gap-5">

        {/* Charger basics */}
        <section className="p-4 rounded-2xl border border-gray-100 bg-white">
          <SectionHeader label="Charger basics" step={1} onEdit={onEditStep} />
          <p className="text-sm font-semibold text-ink">
            {draft.chargerType ? CHARGER_LABELS[draft.chargerType] : <Missing />}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(draft.connectorTypes ?? []).map(c => (
              <span
                key={c}
                className="px-2.5 py-1 rounded-xl bg-volt-soft text-ink text-xs font-semibold"
              >
                {CONNECTOR_LABELS[c] ?? c}
              </span>
            ))}
            {!draft.connectorTypes?.length && <Missing />}
          </div>
        </section>

        {/* Pricing */}
        <section className="p-4 rounded-2xl border border-gray-100 bg-white">
          <SectionHeader label="Pricing" step={2} onEdit={onEditStep} />
          {draft.pricePerKwh != null ? (
            <>
              <p className="text-sm font-semibold text-ink">₹{draft.pricePerKwh}/kWh</p>
              {estimatedEarnings != null && (
                <p className="mt-0.5 text-xs text-muted">
                  ≈ ₹{estimatedEarnings} per typical 10 kWh session (after {PLATFORM_COMMISSION_PERCENT}% fee)
                </p>
              )}
            </>
          ) : (
            <Missing />
          )}
        </section>

        {/* Location */}
        <section className="p-4 rounded-2xl border border-gray-100 bg-white">
          <SectionHeader label="Location" step={3} onEdit={onEditStep} />
          {draft.address ? (
            <p className="text-sm font-semibold text-ink leading-snug">{draft.address}</p>
          ) : (
            <Missing />
          )}
          {draft.latitude != null && draft.longitude != null && (
            <p className="mt-1 text-xs text-muted">
              {draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}
            </p>
          )}
          {mapsApiConfigured && draft.latitude != null && draft.longitude != null && (
            <div className="mt-3">
              <LocationMapPreview
                lat={draft.latitude}
                lng={draft.longitude}
                addressKey={0}
                onMarkerDrag={() => {}}
              />
            </div>
          )}
        </section>

        {/* Photos */}
        <section className="p-4 rounded-2xl border border-gray-100 bg-white">
          <SectionHeader label="Photos" step={4} onEdit={onEditStep} />
          {draft.photos?.length ? (
            <div className="grid grid-cols-4 gap-2 mt-1">
              {draft.photos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Charger photo ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-xl"
                />
              ))}
            </div>
          ) : (
            <Missing />
          )}
        </section>

        {/* Availability */}
        <section className="p-4 rounded-2xl border border-gray-100 bg-white">
          <SectionHeader label="Availability" step={5} onEdit={onEditStep} />
          {draft.availability?.length ? (
            <div className="flex flex-col gap-1 mt-1">
              {draft.availability.map(slot => (
                <p key={slot.day_of_week} className="text-sm text-ink">
                  <span className="font-semibold w-8 inline-block">
                    {DAY_LABELS[slot.day_of_week]}
                  </span>
                  <span className="text-muted">{slot.start_time} – {slot.end_time}</span>
                </p>
              ))}
            </div>
          ) : (
            <Missing />
          )}
        </section>

        {/* Title & instructions */}
        <section className="p-4 rounded-2xl border border-gray-100 bg-white">
          <SectionHeader label="Title & instructions" step={6} onEdit={onEditStep} />
          {draft.title ? (
            <p className="text-sm font-semibold text-ink">{draft.title}</p>
          ) : (
            <Missing />
          )}
          {draft.instructions && (
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              {draft.instructions.length > 150
                ? `${draft.instructions.slice(0, 150)}…`
                : draft.instructions}
            </p>
          )}
        </section>
      </div>

      {/* Terms */}
      <label className="mt-6 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={e => setTermsAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-ink rounded shrink-0"
        />
        <span className="text-sm text-ink leading-snug">
          I confirm I have the right to share this charger and agree to the{' '}
          <a href="#" className="underline text-volt-deep">platform terms</a>.
        </span>
      </label>
    </div>
  );
}

function Missing() {
  return <span className="text-xs text-red-400 font-semibold">Missing — please edit</span>;
}
