import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/admin';
import { PROXIMITY_RADIUS_STEPS } from '@/lib/constants';

export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { enabled, radius_km } = body as { enabled?: unknown; radius_km?: unknown };

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }
  if (typeof radius_km !== 'number' || !(PROXIMITY_RADIUS_STEPS as readonly number[]).includes(radius_km)) {
    return NextResponse.json(
      { error: `radius_km must be one of: ${PROXIMITY_RADIUS_STEPS.join(', ')}` },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const [r1, r2] = await Promise.all([
    adminSupabase.from('app_settings').upsert({ key: 'proximity_check_enabled', value: enabled, updated_at: nowIso }),
    adminSupabase.from('app_settings').upsert({ key: 'proximity_check_radius_km', value: radius_km, updated_at: nowIso }),
  ]);

  if (r1.error || r2.error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }

  return NextResponse.json({ enabled, radius_km });
}
