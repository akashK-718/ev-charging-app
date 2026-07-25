import { createAdminClient } from '@/lib/supabase/server';

export type KillSwitchKey =
  | 'allow_bookings'
  | 'allow_payments'
  | 'allow_payouts'
  | 'allow_registrations'
  | 'allow_charger_creation';

/**
 * Read a single boolean kill-switch from app_settings.
 * Defaults to true (allow) if the row is missing or unreadable —
 * we never fail closed on kill switches.
 */
export async function readKillSwitch(key: KillSwitchKey): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (!data) return true;
    return data.value === true;
  } catch {
    return true;
  }
}

export async function readPlatformMode(): Promise<'normal' | 'maintenance'> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'platform_mode')
      .maybeSingle();
    return data?.value === 'maintenance' ? 'maintenance' : 'normal';
  } catch {
    return 'normal';
  }
}

/** Fetch all emergency-control settings in one query. */
export async function readAllControlSettings(): Promise<{
  allow_bookings: boolean;
  allow_payments: boolean;
  allow_payouts: boolean;
  allow_registrations: boolean;
  allow_charger_creation: boolean;
  platform_mode: 'normal' | 'maintenance';
}> {
  const KEYS: string[] = [
    'allow_bookings', 'allow_payments', 'allow_payouts',
    'allow_registrations', 'allow_charger_creation', 'platform_mode',
  ];
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('app_settings')
      .select('key, value')
      .in('key', KEYS);

    const map = Object.fromEntries((data ?? []).map(r => [r.key, r.value as unknown]));
    return {
      allow_bookings:         (map.allow_bookings         as boolean | undefined) ?? true,
      allow_payments:         (map.allow_payments         as boolean | undefined) ?? true,
      allow_payouts:          (map.allow_payouts          as boolean | undefined) ?? true,
      allow_registrations:    (map.allow_registrations    as boolean | undefined) ?? true,
      allow_charger_creation: (map.allow_charger_creation as boolean | undefined) ?? true,
      platform_mode:          (map.platform_mode as string | undefined) === 'maintenance' ? 'maintenance' : 'normal',
    };
  } catch {
    return {
      allow_bookings: true, allow_payments: true, allow_payouts: true,
      allow_registrations: true, allow_charger_creation: true,
      platform_mode: 'normal',
    };
  }
}
