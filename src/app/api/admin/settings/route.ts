import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin';
import { readAllControlSettings } from '@/lib/app-settings';
import { isEmergencyLockdown, getFeatureFlags } from '@/lib/edge-config';

/** GET /api/admin/settings — returns all current control settings. */
export async function GET() {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [controls, lockdown, featureFlags] = await Promise.all([
    readAllControlSettings(),
    isEmergencyLockdown(),
    getFeatureFlags(),
  ]);

  return NextResponse.json({
    kill_switches: {
      allow_bookings:         controls.allow_bookings,
      allow_payments:         controls.allow_payments,
      allow_payouts:          controls.allow_payouts,
      allow_registrations:    controls.allow_registrations,
      allow_charger_creation: controls.allow_charger_creation,
    },
    platform_mode: controls.platform_mode,
    emergency_lockdown: lockdown,
    feature_flags: featureFlags,
  });
}
