'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PROXIMITY_RADIUS_STEPS } from '@/lib/constants';

interface Props {
  initialEnabled: boolean;
  initialRadiusKm: number;
}

export function ProximityCheckCard({ initialEnabled, initialRadiusKm }: Props) {
  const [saved, setSaved] = useState({ enabled: initialEnabled, radiusKm: initialRadiusKm });
  const [enabled, setEnabled] = useState(initialEnabled);
  const [radiusKm, setRadiusKm] = useState(initialRadiusKm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const isDirty = enabled !== saved.enabled || radiusKm !== saved.radiusKm;

  // Map radius value to slider integer (0.1→1, 0.2→2, … 1.0→10)
  const sliderValue = Math.round(radiusKm * 10);

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const idx = Number(e.target.value) - 1;
    setRadiusKm(PROXIMITY_RADIUS_STEPS[idx]);
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch('/api/admin/settings/proximity-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, radius_km: radiusKm }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setToast({ type: 'error', msg: body.error ?? 'Failed to save' });
        return;
      }
      setSaved({ enabled, radiusKm });
      setToast({ type: 'success', msg: 'Settings saved' });
    } catch {
      setToast({ type: 'error', msg: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      {/* Header + toggle */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm text-ink">Proximity check</p>
          <p className="text-xs text-muted mt-0.5">
            Block session start if driver is too far from the charger
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(v => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-volt ${
            enabled ? 'bg-volt-deep' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Radius slider */}
      <div className={`space-y-2 transition-opacity ${enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Radius</p>
          <p className="text-sm font-bold text-ink tabular-nums">{radiusKm.toFixed(1)} km</p>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={sliderValue}
          onChange={handleSliderChange}
          disabled={!enabled}
          className="w-full accent-volt-deep cursor-pointer disabled:cursor-default"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>0.1 km</span>
          <span>1.0 km</span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <p className={`text-xs font-semibold ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {toast.msg}
        </p>
      )}

      {/* Save */}
      <Button
        variant="secondary"
        size="md"
        disabled={!isDirty || saving}
        onClick={() => { void handleSave(); }}
      >
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
