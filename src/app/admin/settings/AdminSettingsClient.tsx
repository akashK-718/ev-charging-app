'use client';

import { useState, useTransition } from 'react';
import type { FeatureFlags } from '@/lib/edge-config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Controls {
  allow_bookings: boolean;
  allow_payments: boolean;
  allow_payouts: boolean;
  allow_registrations: boolean;
  allow_charger_creation: boolean;
  platform_mode: 'normal' | 'maintenance';
}

interface Props {
  initialControls: Controls;
  initialLockdown: boolean;
  initialFeatureFlags: FeatureFlags;
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  danger,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        checked
          ? danger ? 'bg-danger' : 'bg-green'
          : 'bg-gray-200',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
          'transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-bold tracking-widest text-muted uppercase">{title}</p>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  checked,
  onChange,
  busy,
  danger,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={busy} danger={danger} />
    </div>
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span className={[
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
      active ? 'bg-danger-soft text-danger' : 'bg-green-soft text-green-deep',
    ].join(' ')}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  function show(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  }
  return { msg, show };
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminSettingsClient({ initialControls, initialLockdown, initialFeatureFlags }: Props) {
  const [controls, setControls] = useState(initialControls);
  const [lockdown, setLockdown] = useState(initialLockdown);
  const [flags, setFlags] = useState(initialFeatureFlags);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  // ── Kill switches ─────────────────────────────────────────────────────────

  async function toggleKillSwitch(key: keyof Omit<Controls, 'platform_mode'>, value: boolean) {
    const prev = controls[key];
    setControls(c => ({ ...c, [key]: value }));
    try {
      const res = await fetch('/api/admin/settings/kill-switches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      toast.show(`${key} set to ${value}`);
    } catch (err) {
      setControls(c => ({ ...c, [key]: prev }));
      toast.show(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, false);
    }
  }

  // ── Maintenance mode ──────────────────────────────────────────────────────

  async function toggleMaintenance(maintenance: boolean) {
    const newMode = maintenance ? 'maintenance' : 'normal';
    const prev = controls.platform_mode;
    setControls(c => ({ ...c, platform_mode: newMode }));
    try {
      const res = await fetch('/api/admin/settings/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      toast.show(`Platform mode: ${newMode}`);
    } catch (err) {
      setControls(c => ({ ...c, platform_mode: prev }));
      toast.show(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, false);
    }
  }

  // ── Feature flags ─────────────────────────────────────────────────────────

  async function toggleFlag(flag: keyof FeatureFlags, value: boolean) {
    const prev = flags[flag];
    setFlags(f => ({ ...f, [flag]: value }));
    const reason = value ? `${flag} enabled by admin` : `${flag} disabled by admin`;
    try {
      const res = await fetch('/api/admin/settings/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag, value, reason }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      toast.show(`${flag} set to ${value}`);
    } catch (err) {
      setFlags(f => ({ ...f, [flag]: prev }));
      toast.show(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, false);
    }
  }

  // ── Emergency lockdown ────────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Platform settings</h1>
        <p className="text-sm text-muted mt-0.5">Operational controls for this environment.</p>
      </div>

      {/* Toast */}
      {toast.msg && (
        <div className={[
          'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-elevated',
          toast.msg.ok ? 'bg-ink text-white' : 'bg-danger text-white',
        ].join(' ')}>
          {toast.msg.text}
        </div>
      )}

      {/* ── Emergency lockdown ───────────────────────────────────────────── */}
      <LockdownPanel
        locked={lockdown}
        onUpdate={(v) => {
          setLockdown(v);
          toast.show(v ? 'Emergency lockdown ACTIVATED' : 'Lockdown deactivated');
        }}
        onError={(msg) => toast.show(msg, false)}
      />

      {/* ── Maintenance mode ─────────────────────────────────────────────── */}
      <Section title="Maintenance mode">
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <p className="text-sm font-semibold text-ink">Maintenance mode</p>
              <p className="text-xs text-muted mt-0.5">
                Redirects all non-admin traffic to the maintenance page.
                Admins see the app normally.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusChip
                active={controls.platform_mode === 'maintenance'}
                activeLabel="On"
                inactiveLabel="Off"
              />
              <Toggle
                checked={controls.platform_mode === 'maintenance'}
                onChange={(v) => { void toggleMaintenance(v); }}
                disabled={isPending}
                danger
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Kill switches ────────────────────────────────────────────────── */}
      <Section title="Operational kill switches">
        <SettingRow
          label="Allow bookings"
          description="Booking creation via Razorpay checkout"
          checked={controls.allow_bookings}
          onChange={(v) => { startTransition(() => { void toggleKillSwitch('allow_bookings', v); }); }}
          busy={isPending}
          danger={!controls.allow_bookings}
        />
        <SettingRow
          label="Allow payments"
          description="Razorpay order creation and payment verification"
          checked={controls.allow_payments}
          onChange={(v) => { startTransition(() => { void toggleKillSwitch('allow_payments', v); }); }}
          busy={isPending}
          danger={!controls.allow_payments}
        />
        <SettingRow
          label="Allow payouts"
          description="Admin marking of payouts as processed"
          checked={controls.allow_payouts}
          onChange={(v) => { startTransition(() => { void toggleKillSwitch('allow_payouts', v); }); }}
          busy={isPending}
          danger={!controls.allow_payouts}
        />
        <SettingRow
          label="Allow registrations"
          description="New account creation (existing users can still sign in)"
          checked={controls.allow_registrations}
          onChange={(v) => { startTransition(() => { void toggleKillSwitch('allow_registrations', v); }); }}
          busy={isPending}
          danger={!controls.allow_registrations}
        />
        <SettingRow
          label="Allow charger creation"
          description="Lenders listing new chargers"
          checked={controls.allow_charger_creation}
          onChange={(v) => { startTransition(() => { void toggleKillSwitch('allow_charger_creation', v); }); }}
          busy={isPending}
          danger={!controls.allow_charger_creation}
        />
      </Section>

      {/* ── Feature flags ────────────────────────────────────────────────── */}
      <Section title="Feature flags (Edge Config)">
        <SettingRow
          label="Route planning"
          description="Along Route mode in Explore — chargers_along_route() PostGIS RPC"
          checked={flags.route_planning_enabled}
          onChange={(v) => { void toggleFlag('route_planning_enabled', v); }}
          busy={isPending}
        />
        <SettingRow
          label="Ratings"
          description="Driver/lender review submission after completed bookings"
          checked={flags.ratings_enabled}
          onChange={(v) => { void toggleFlag('ratings_enabled', v); }}
          busy={isPending}
        />
        <SettingRow
          label="Saved chargers"
          description="Not yet built — flag defaulting false"
          checked={flags.saved_chargers_enabled}
          onChange={(v) => { void toggleFlag('saved_chargers_enabled', v); }}
          busy={isPending}
        />
        <SettingRow
          label="Vehicles"
          description="Not yet built — flag defaulting false"
          checked={flags.vehicles_enabled}
          onChange={(v) => { void toggleFlag('vehicles_enabled', v); }}
          busy={isPending}
        />
      </Section>

      <p className="text-xs text-muted pb-8">
        Kill switch changes take effect immediately. Edge Config changes (lockdown, feature flags)
        propagate globally within seconds. All changes are logged to audit_log.
      </p>
    </div>
  );
}

// ── Lockdown panel (own component — has local form state) ─────────────────────

function LockdownPanel({
  locked,
  onUpdate,
  onError,
}: {
  locked: boolean;
  onUpdate: (v: boolean) => void;
  onError: (msg: string) => void;
}) {
  const [currentLocked, setCurrentLocked] = useState(locked);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function activate() {
    if (confirmation !== 'LOCKDOWN') return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/settings/emergency-lockdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: true, reason: reason || 'Manual activation', confirmation }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Unknown error');
      setCurrentLocked(true);
      setShowConfirm(false);
      setConfirmation('');
      setReason('');
      onUpdate(true);
    } catch (err) {
      onError(`Lockdown failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/settings/emergency-lockdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: false, reason: 'Manual deactivation' }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Unknown error');
      setCurrentLocked(false);
      onUpdate(false);
    } catch (err) {
      onError(`Deactivation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={[
      'rounded-2xl border overflow-hidden',
      currentLocked ? 'border-danger bg-danger-soft' : 'border-border bg-white',
    ].join(' ')}>
      <div className="px-4 py-3 border-b border-inherit flex items-center justify-between gap-3">
        <p className="text-xs font-bold tracking-widest text-muted uppercase">Emergency lockdown</p>
        {currentLocked && (
          <span className="px-2 py-0.5 rounded-full bg-danger text-white text-xs font-bold animate-pulse">
            ACTIVE
          </span>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        <p className="text-sm text-ink-soft leading-relaxed">
          Blocks all non-admin page and API traffic. Checked via Vercel Edge Config — independent
          of Supabase. Admins retain access to investigate and deactivate.
        </p>

        {currentLocked ? (
          <button
            onClick={() => { void deactivate(); }}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl bg-ink text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
          >
            {busy ? 'Deactivating…' : 'Deactivate lockdown'}
          </button>
        ) : showConfirm ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">
                Reason (logged to audit_log)
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Suspected payment fraud"
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-danger/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-1">
                Type <span className="font-mono text-danger">LOCKDOWN</span> to confirm
              </label>
              <input
                type="text"
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                placeholder="LOCKDOWN"
                autoCapitalize="characters"
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm font-mono text-danger bg-white focus:outline-none focus:ring-2 focus:ring-danger/30"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { void activate(); }}
                disabled={busy || confirmation !== 'LOCKDOWN' || !reason.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
              >
                {busy ? 'Activating…' : 'Activate lockdown'}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setConfirmation(''); setReason(''); }}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-ink-soft"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2.5 rounded-xl border border-danger text-danger text-sm font-semibold hover:bg-danger-soft transition-colors"
          >
            Activate emergency lockdown
          </button>
        )}
      </div>
    </div>
  );
}
