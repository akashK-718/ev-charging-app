'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CHARGER_TYPES, CONNECTOR_TYPES } from '@/lib/constants';
import type { ChargerType } from '@/types/charger';
import type { ConnectorType } from '@/lib/constants';
import type { NewChargerDraft } from '@/types/charger-draft';

const CHARGER_DESCRIPTIONS: Record<ChargerType, string> = {
  'AC_3.3kW': 'Adds ~15–25 km per hour · ideal for overnight charging',
  'AC_7kW': 'Adds ~35–50 km per hour · charges most EVs in 3–5 hrs',
  'AC_22kW': 'Adds ~100 km per hour · requires 3-phase supply',
  'DC_fast': '80% charge in under 30 min · commercial-grade hardware',
};

const CHARGER_SHORT: Record<ChargerType, string> = {
  'AC_3.3kW': '3.3',
  'AC_7kW': '7',
  'AC_22kW': '22',
  'DC_fast': 'DC',
};

const CONNECTOR_LABELS: Record<ConnectorType, string> = {
  Type2: 'Type 2',
  BharatAC: 'Bharat AC',
  CCS2: 'CCS2',
  CHAdeMO: 'CHAdeMO',
  Type1: 'Type 1',
};

interface StepBasicsProps {
  draft: Partial<NewChargerDraft>;
  onChange: (updates: Partial<NewChargerDraft>) => void;
  onValidChange: (valid: boolean) => void;
}

export function StepBasics({ draft, onChange, onValidChange }: StepBasicsProps) {
  const [connectorsTouched, setConnectorsTouched] = useState(false);

  const selectedType = draft.chargerType;
  const selectedConnectors = draft.connectorTypes ?? [];
  const isValid = !!selectedType && selectedConnectors.length > 0;

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  function toggleConnector(c: ConnectorType) {
    setConnectorsTouched(true);
    const next = selectedConnectors.includes(c)
      ? selectedConnectors.filter(x => x !== c)
      : [...selectedConnectors, c];
    onChange({ connectorTypes: next });
  }

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Charger basics</h1>
      <p className="mt-2 text-base text-muted">Tell us about your charger hardware.</p>

      <section className="mt-8">
        <p className="text-sm font-semibold text-ink mb-3">Charger type</p>
        <div className="flex flex-col gap-3">
          {CHARGER_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ chargerType: value as ChargerType })}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-colors',
                selectedType === value
                  ? 'border-volt bg-volt-soft'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <span
                className={cn(
                  'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
                  'font-display font-bold text-xs',
                  selectedType === value
                    ? 'bg-volt text-ink'
                    : 'bg-gray-100 text-ink-soft',
                )}
              >
                {CHARGER_SHORT[value as ChargerType]}
              </span>
              <div>
                <p className="font-display font-bold text-ink text-sm">{label}</p>
                <p className="text-xs text-muted mt-0.5">
                  {CHARGER_DESCRIPTIONS[value as ChargerType]}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <p className="text-sm font-semibold text-ink mb-1">Connector type(s)</p>
        <p className="text-xs text-muted mb-3">Select all that your charger supports</p>
        <div className="flex flex-wrap gap-2">
          {CONNECTOR_TYPES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleConnector(c)}
              className={cn(
                'h-10 px-4 rounded-xl border-2 text-sm font-semibold transition-colors',
                selectedConnectors.includes(c)
                  ? 'border-volt bg-volt text-ink'
                  : 'border-gray-200 bg-white text-ink hover:border-gray-300',
              )}
            >
              {CONNECTOR_LABELS[c]}
            </button>
          ))}
        </div>
        {connectorsTouched && selectedConnectors.length === 0 && (
          <p className="mt-2 text-xs text-red-500 font-semibold">
            Select at least one connector type
          </p>
        )}
      </section>
    </div>
  );
}
