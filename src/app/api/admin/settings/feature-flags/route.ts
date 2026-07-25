import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, logAdminAction } from '@/lib/admin';
import { getFeatureFlags, updateEdgeConfigItem, type FeatureFlags } from '@/lib/edge-config';

const VALID_FLAGS: (keyof FeatureFlags)[] = [
  'route_planning_enabled',
  'ratings_enabled',
  'saved_chargers_enabled',
  'vehicles_enabled',
];

/** POST /api/admin/settings/feature-flags — toggle a feature flag. */
export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { flag, value, reason } = body as Record<string, unknown>;

  if (!VALID_FLAGS.includes(flag as keyof FeatureFlags)) {
    return NextResponse.json(
      { error: `Invalid flag. Must be one of: ${VALID_FLAGS.join(', ')}` },
      { status: 400 },
    );
  }
  if (typeof value !== 'boolean') {
    return NextResponse.json({ error: 'value must be a boolean' }, { status: 400 });
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const currentFlags = await getFeatureFlags();
  const previousValue = currentFlags[flag as keyof FeatureFlags];

  try {
    await updateEdgeConfigItem(flag as string, value);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to update Edge Config: ${msg}` }, { status: 500 });
  }

  await logAdminAction(adminUser.id, 'feature_flag_changed', adminUser.id, {
    flag,
    reason: reason.trim(),
    previous_state: previousValue,
    new_state: value,
  });

  return NextResponse.json({ ok: true });
}
