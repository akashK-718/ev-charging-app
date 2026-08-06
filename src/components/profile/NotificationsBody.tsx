'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, CalendarCheck, BatteryCharging,
  Home, ShieldCheck, Wallet, Megaphone, Tag, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Prefs = {
  booking_updates: boolean;
  charging_reminders: boolean;
  hosting_activity: boolean;
  kyc_updates: boolean;
  payments_payouts: boolean;
  product_announcements: boolean;
  promotions_offers: boolean;
};

type PrefKey = keyof Prefs;

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2',
        checked ? 'bg-green' : 'bg-border',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer active:scale-95 transition',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function PrefRow({
  icon,
  label,
  description,
  checked,
  onChange,
  locked,
  lockedReason,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
  lockedReason?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="size-9 rounded-2xl bg-green-soft text-green-deep grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted leading-relaxed mt-0.5">
          {locked ? lockedReason : description}
        </p>
      </div>
      {locked ? (
        <Lock className="size-4 text-muted shrink-0" />
      ) : (
        <Toggle checked={checked} onChange={onChange} label={label} />
      )}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">{children}</p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationsBody({ initialPrefs }: { initialPrefs: Prefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [saving, setSaving] = useState<PrefKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: PrefKey, value: boolean) {
    setPrefs(p => ({ ...p, [key]: value }));
    setSaving(key);
    setError(null);
    try {
      const res = await fetch('/api/users/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch {
      // Roll back optimistic update on failure
      setPrefs(p => ({ ...p, [key]: !value }));
      setError('Could not save. Please try again.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="pb-8">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="size-9 grid place-items-center rounded-full bg-white border border-border shadow-sm active:scale-95 transition shrink-0"
        >
          <ChevronLeft className="size-5 text-ink" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink">Notifications</h1>
          <p className="text-xs text-muted mt-0.5">Choose what you want to be notified about</p>
        </div>
      </div>

      {error && (
        <p className="mx-4 mb-3 text-xs text-danger font-medium">{error}</p>
      )}

      {/* Bookings & Charging */}
      <div className="px-4 mb-6">
        <SectionLabel>Bookings & Charging</SectionLabel>
        <div className="bg-white border border-border rounded-3xl shadow-sm overflow-hidden divide-y divide-border">
          <PrefRow
            icon={<CalendarCheck className="size-4" />}
            label="Booking updates"
            description="Confirmations, rejections, cancellations, and session completions."
            checked={prefs.booking_updates}
            onChange={v => { void toggle('booking_updates', v); }}
          />
          <PrefRow
            icon={<BatteryCharging className="size-4" />}
            label="Charging reminders"
            description="Prompts to start or confirm the end of your charging session."
            checked={prefs.charging_reminders}
            onChange={v => { void toggle('charging_reminders', v); }}
          />
        </div>
      </div>

      {/* Hosting */}
      <div className="px-4 mb-6">
        <SectionLabel>Hosting</SectionLabel>
        <div className="bg-white border border-border rounded-3xl shadow-sm overflow-hidden">
          <PrefRow
            icon={<Home className="size-4" />}
            label="Hosting activity"
            description="New booking requests, session starts, no-show warnings, and guest updates."
            checked={prefs.hosting_activity}
            onChange={v => { void toggle('hosting_activity', v); }}
          />
        </div>
      </div>

      {/* Account */}
      <div className="px-4 mb-6">
        <SectionLabel>Account</SectionLabel>
        <div className="bg-white border border-border rounded-3xl shadow-sm overflow-hidden divide-y divide-border">
          <PrefRow
            icon={<ShieldCheck className="size-4" />}
            label="KYC updates"
            description="Identity verification approvals, rejections, and resubmission requests."
            checked={prefs.kyc_updates}
            onChange={v => { void toggle('kyc_updates', v); }}
          />
          <PrefRow
            icon={<Wallet className="size-4" />}
            label="Payments & payouts"
            description="Payout processed and payment activity on your account."
            checked={prefs.payments_payouts}
            onChange={v => { void toggle('payments_payouts', v); }}
          />
          <PrefRow
            icon={<Lock className="size-4" />}
            label="Security alerts"
            description=""
            checked={true}
            locked
            lockedReason="Required for account security — cannot be turned off."
          />
        </div>
      </div>

      {/* Promotions */}
      <div className="px-4 mb-6">
        <SectionLabel>Promotions</SectionLabel>
        <div className="bg-white border border-border rounded-3xl shadow-sm overflow-hidden divide-y divide-border">
          <PrefRow
            icon={<Megaphone className="size-4" />}
            label="Product announcements"
            description="New features, improvements, and platform updates."
            checked={prefs.product_announcements}
            onChange={v => { void toggle('product_announcements', v); }}
          />
          <PrefRow
            icon={<Tag className="size-4" />}
            label="Promotions & offers"
            description="Discounts, special rates, and limited-time offers."
            checked={prefs.promotions_offers}
            onChange={v => { void toggle('promotions_offers', v); }}
          />
        </div>
      </div>

      <p className="text-center text-[10px] text-muted leading-relaxed px-8">
        Push notifications require browser permission.{' '}
        Changes take effect immediately across all your devices.
      </p>

    </div>
  );
}
