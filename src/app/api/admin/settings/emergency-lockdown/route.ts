import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, logAdminAction } from '@/lib/admin';
import { isEmergencyLockdown, updateEdgeConfigItem } from '@/lib/edge-config';

const REQUIRED_CONFIRMATION = 'LOCKDOWN';

/**
 * POST /api/admin/settings/emergency-lockdown
 *
 * Body: { locked: boolean, reason: string, confirmation: string }
 *
 * Activation requires confirmation === "LOCKDOWN".
 * Deactivation does not require confirmation.
 * Both paths write an audit_log entry.
 */
export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { locked, reason, confirmation } = body as Record<string, unknown>;

  if (typeof locked !== 'boolean') {
    return NextResponse.json({ error: 'locked must be a boolean' }, { status: 400 });
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  // Activation requires the admin to type "LOCKDOWN" to prevent accidental triggers.
  if (locked && confirmation !== REQUIRED_CONFIRMATION) {
    return NextResponse.json(
      { error: 'Type "LOCKDOWN" to confirm activation.' },
      { status: 422 },
    );
  }

  const previousState = await isEmergencyLockdown();

  try {
    await updateEdgeConfigItem('emergency_lockdown', locked);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to update Edge Config: ${msg}` }, { status: 500 });
  }

  // Audit log — non-fatal; written after Edge Config update succeeds.
  await logAdminAction(
    adminUser.id,
    locked ? 'emergency_lockdown_activated' : 'emergency_lockdown_deactivated',
    adminUser.id,
    {
      reason: reason.trim(),
      previous_state: previousState,
      new_state: locked,
    },
  );

  return NextResponse.json({ ok: true, locked });
}
