import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, logAdminAction } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';
import type { KillSwitchKey } from '@/lib/app-settings';

const VALID_KEYS: KillSwitchKey[] = [
  'allow_bookings',
  'allow_payments',
  'allow_payouts',
  'allow_registrations',
  'allow_charger_creation',
];

/** POST /api/admin/settings/kill-switches — toggle a kill switch. */
export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { key, value } = body as Record<string, unknown>;

  if (!VALID_KEYS.includes(key as KillSwitchKey)) {
    return NextResponse.json({ error: `Invalid key. Must be one of: ${VALID_KEYS.join(', ')}` }, { status: 400 });
  }
  if (typeof value !== 'boolean') {
    return NextResponse.json({ error: 'value must be a boolean' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Read previous value for audit
  const { data: prev } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', key as string)
    .maybeSingle();
  const previousValue = prev?.value ?? true;

  const { error } = await admin
    .from('app_settings')
    .upsert({ key: key as string, value, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }

  await logAdminAction(adminUser.id, 'kill_switch_toggled', adminUser.id, {
    key,
    previous_state: previousValue,
    new_state: value,
  });

  return NextResponse.json({ ok: true });
}
