'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Car, Check, X } from 'lucide-react';
import { BackHeader } from '@/components/ui/PageHeader';
import { Sheet } from '@/components/ui/Sheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { CONNECTOR_TYPES, CONNECTOR_LABELS } from '@/lib/constants';
import type { ConnectorType } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  user_id: string;
  nickname: string | null;
  make: string;
  model: string;
  connector_types: string[];
  battery_capacity_kwh: number | null;
  license_plate: string | null;
  is_default: boolean;
  created_at: string;
}

interface VehiclesClientProps {
  initialVehicles: Vehicle[];
}

// ── Form helpers ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  make: '',
  model: '',
  nickname: '',
  connector_types: [] as string[],
  battery_capacity_kwh: '',
  license_plate: '',
};

interface FormErrors {
  make?: string;
  model?: string;
  connector_types?: string;
}

function vehicleToForm(v: Vehicle) {
  return {
    make: v.make,
    model: v.model,
    nickname: v.nickname ?? '',
    connector_types: [...v.connector_types],
    battery_capacity_kwh: v.battery_capacity_kwh != null ? String(v.battery_capacity_kwh) : '',
    license_plate: v.license_plate ?? '',
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConnectorBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-soft text-green-deep border border-green/20">
      {CONNECTOR_LABELS[type as ConnectorType] ?? type}
    </span>
  );
}

function FormInput({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-muted uppercase tracking-wide">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger font-medium">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green transition-colors';

// ── Main component ─────────────────────────────────────────────────────────────

export function VehiclesClient({ initialVehicles }: VehiclesClientProps) {
  const router = useRouter();

  // ── Vehicles list ──────────────────────────────────────────────────────────
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);

  // ── Form sheet (add / edit) ────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Delete confirmation ────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Set-default in-flight tracking ────────────────────────────────────────
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // ── Form helpers ───────────────────────────────────────────────────────────

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setForm(vehicleToForm(vehicle));
    setFormErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key in formErrors) setFormErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function toggleConnector(ct: string) {
    setForm(prev => {
      const next = prev.connector_types.includes(ct)
        ? prev.connector_types.filter(c => c !== ct)
        : [...prev.connector_types, ct];
      return { ...prev, connector_types: next };
    });
    if (formErrors.connector_types) setFormErrors(prev => ({ ...prev, connector_types: undefined }));
  }

  function validate(): boolean {
    const errors: FormErrors = {};
    if (!form.make.trim()) errors.make = 'Make is required';
    if (!form.model.trim()) errors.model = 'Model is required';
    if (form.connector_types.length === 0) errors.connector_types = 'Select at least one connector type';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── API calls ──────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!validate()) return;
    setFormLoading(true);
    setFormError(null);

    const payload = {
      make: form.make.trim(),
      model: form.model.trim(),
      nickname: form.nickname.trim() || undefined,
      connector_types: form.connector_types,
      battery_capacity_kwh: form.battery_capacity_kwh ? Number(form.battery_capacity_kwh) : null,
      license_plate: form.license_plate.trim() || undefined,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/users/vehicles/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json() as { error?: string };
          setFormError(d.error ?? 'Could not save changes');
          return;
        }
        const { vehicle } = await res.json() as { vehicle: Vehicle };
        setVehicles(prev => prev.map(v => v.id === editingId ? vehicle : v));
      } else {
        const res = await fetch('/api/users/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json() as { error?: string };
          setFormError(d.error ?? 'Could not add vehicle');
          return;
        }
        const { vehicle } = await res.json() as { vehicle: Vehicle };
        // First vehicle is auto-set as default — reflect that in state
        setVehicles(prev => {
          if (vehicle.is_default) {
            return [...prev.map(v => ({ ...v, is_default: false })), vehicle];
          }
          return [...prev, vehicle];
        });
      }
      closeForm();
      router.refresh();
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleSetDefault(vehicleId: string) {
    setSettingDefaultId(vehicleId);
    try {
      const res = await fetch(`/api/users/vehicles/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) return;
      setVehicles(prev =>
        prev.map(v => ({ ...v, is_default: v.id === vehicleId })),
      );
      router.refresh();
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/users/vehicles/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setDeleteError(d.error ?? 'Could not delete vehicle');
        return;
      }
      const wasDefault = vehicles.find(v => v.id === deleteId)?.is_default ?? false;
      setVehicles(prev => {
        const remaining = prev.filter(v => v.id !== deleteId);
        if (wasDefault && remaining.length > 0) {
          remaining[0] = { ...remaining[0], is_default: true };
        }
        return remaining;
      });
      setDeleteId(null);
      router.refresh();
    } catch {
      setDeleteError('Something went wrong. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const editingVehicle = editingId ? vehicles.find(v => v.id === editingId) : undefined;

  return (
    <>
      <BackHeader title="My Vehicles" href="/profile" />

      <main className="px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10 max-w-lg mx-auto space-y-3">

        {vehicles.length === 0 && (
          <div className="text-center py-12">
            <div className="size-14 rounded-full bg-green-soft grid place-items-center mx-auto mb-4">
              <Car className="size-7 text-green-deep" />
            </div>
            <p className="text-sm font-semibold text-ink">No vehicles yet</p>
            <p className="text-xs text-muted mt-1">
              Add your EV to get personalised charger suggestions.
            </p>
          </div>
        )}

        {vehicles.map(vehicle => {
          const displayName = vehicle.nickname
            ? vehicle.nickname
            : `${vehicle.make} ${vehicle.model}`;

          return (
            <div key={vehicle.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-2xl bg-green-soft grid place-items-center shrink-0 mt-0.5">
                  <Car className="size-5 text-green-deep" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ink">{displayName}</p>
                    {vehicle.is_default && (
                      <span className="text-[10px] font-bold text-green bg-green-soft rounded-full px-2 py-0.5 uppercase tracking-wide">
                        Default
                      </span>
                    )}
                  </div>
                  {vehicle.nickname && (
                    <p className="text-xs text-muted mt-0.5">{vehicle.make} {vehicle.model}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {vehicle.connector_types.map(ct => (
                      <ConnectorBadge key={ct} type={ct} />
                    ))}
                  </div>
                  {vehicle.battery_capacity_kwh != null && (
                    <p className="text-xs text-muted mt-1.5">{vehicle.battery_capacity_kwh} kWh battery</p>
                  )}
                  {vehicle.license_plate && (
                    <p className="text-xs text-muted mt-0.5">{vehicle.license_plate}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(vehicle)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-surface-page text-xs font-semibold text-ink hover:bg-gray-200 transition-colors"
                >
                  Edit
                </button>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                {vehicle.is_default ? (
                  <div className="flex items-center gap-1.5 flex-1 text-xs text-green font-semibold">
                    <Check className="size-3.5" />
                    Default vehicle
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { void handleSetDefault(vehicle.id); }}
                    disabled={settingDefaultId === vehicle.id}
                    className="flex-1 text-xs font-semibold text-green py-1.5 rounded-lg hover:bg-green-soft transition-colors disabled:opacity-50 text-left px-1"
                  >
                    {settingDefaultId === vehicle.id ? 'Setting…' : 'Set as default'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setDeleteId(vehicle.id); setDeleteError(null); }}
                  className="p-2 rounded-lg text-danger/70 hover:text-danger hover:bg-danger-soft transition-colors"
                  aria-label="Delete vehicle"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={openAdd}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted hover:border-green hover:text-green transition-colors"
        >
          <Plus className="size-4" />
          Add vehicle
        </button>
      </main>

      {/* ── Add / Edit sheet ──────────────────────────────────────────────── */}
      <Sheet
        open={formOpen}
        onClose={closeForm}
        title={editingId ? 'Edit vehicle' : 'Add vehicle'}
      >
        <div className="space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Make" required error={formErrors.make}>
              <input
                className={cn(inputClass, formErrors.make && 'border-danger')}
                value={form.make}
                onChange={e => setField('make', e.target.value)}
                placeholder="e.g. Tata"
                autoComplete="off"
              />
            </FormInput>
            <FormInput label="Model" required error={formErrors.model}>
              <input
                className={cn(inputClass, formErrors.model && 'border-danger')}
                value={form.model}
                onChange={e => setField('model', e.target.value)}
                placeholder="e.g. Nexon EV"
                autoComplete="off"
              />
            </FormInput>
          </div>

          <FormInput label="Nickname" hint="Optional — e.g. My Tesla, Family Car">
            <input
              className={inputClass}
              value={form.nickname}
              onChange={e => setField('nickname', e.target.value)}
              placeholder="e.g. My Nexon"
              autoComplete="off"
            />
          </FormInput>

          <FormInput
            label="Connector type(s)"
            required
            error={formErrors.connector_types as string | undefined}
            hint="Select all that apply — include adapters"
          >
            <div className="grid grid-cols-2 gap-2 mt-0.5">
              {CONNECTOR_TYPES.map(ct => {
                const selected = form.connector_types.includes(ct);
                return (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => toggleConnector(ct)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors text-left',
                      selected
                        ? 'bg-green-soft border-green text-green-deep'
                        : 'bg-white border-border text-muted hover:border-green/50 hover:text-ink',
                    )}
                  >
                    <span
                      className={cn(
                        'size-4 rounded border-2 shrink-0 grid place-items-center transition-colors',
                        selected ? 'bg-green border-green' : 'border-border',
                      )}
                    >
                      {selected && <Check className="size-2.5 text-white" strokeWidth={3} />}
                    </span>
                    {CONNECTOR_LABELS[ct]}
                  </button>
                );
              })}
            </div>
          </FormInput>

          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Battery capacity" hint="kWh, optional">
              <div className="relative">
                <input
                  className={cn(inputClass, 'pr-10')}
                  type="number"
                  min="1"
                  max="200"
                  step="0.1"
                  value={form.battery_capacity_kwh}
                  onChange={e => setField('battery_capacity_kwh', e.target.value)}
                  placeholder="e.g. 40.5"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">kWh</span>
              </div>
            </FormInput>
            <FormInput label="Licence plate" hint="Optional">
              <input
                className={inputClass}
                value={form.license_plate}
                onChange={e => setField('license_plate', e.target.value)}
                placeholder="e.g. MH 01 AB 1234"
                autoComplete="off"
              />
            </FormInput>
          </div>

          {formError && (
            <p className="text-sm text-danger font-medium">{formError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={closeForm}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-page transition-colors"
            >
              Cancel
            </button>
            <div className="flex-1">
              <PrimaryButton
                size="md"
                loading={formLoading}
                onClick={() => { void handleSave(); }}
                className="w-full"
              >
                {editingId ? 'Save changes' : 'Add vehicle'}
              </PrimaryButton>
            </div>
          </div>

          {editingVehicle && !editingVehicle.is_default && (
            <button
              type="button"
              onClick={() => {
                closeForm();
                void handleSetDefault(editingVehicle.id);
              }}
              className="w-full text-sm font-semibold text-green py-2 rounded-xl hover:bg-green-soft transition-colors"
            >
              Make this my default vehicle
            </button>
          )}
        </div>
      </Sheet>

      {/* ── Delete confirmation sheet ──────────────────────────────────── */}
      <Sheet
        open={deleteId !== null}
        onClose={() => { setDeleteId(null); setDeleteError(null); }}
        title="Remove vehicle?"
      >
        <div className="space-y-4">
          {deleteId && (() => {
            const target = vehicles.find(v => v.id === deleteId);
            if (!target) return null;
            const name = target.nickname ?? `${target.make} ${target.model}`;
            const isOnlyVehicle = vehicles.length === 1;
            const willPromote = target.is_default && !isOnlyVehicle;
            return (
              <>
                <p className="text-sm text-ink">
                  Remove <strong>{name}</strong> from your garage?
                </p>
                {willPromote && (
                  <p className="text-xs text-muted leading-relaxed">
                    Another vehicle will automatically become your default.
                  </p>
                )}
                {deleteError && (
                  <p className="text-sm text-danger font-medium">{deleteError}</p>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setDeleteId(null); setDeleteError(null); }}
                    className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-page transition-colors"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleDelete(); }}
                    disabled={deleteLoading}
                    className="flex-1 py-3 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-colors disabled:opacity-50"
                  >
                    {deleteLoading ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </Sheet>
    </>
  );
}
