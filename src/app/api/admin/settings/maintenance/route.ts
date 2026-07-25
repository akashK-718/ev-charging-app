import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, logAdminAction } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';

/** POST /api/admin/settings/maintenance — set platform_mode. */
export async function POST(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { mode } = body as Record<string, unknown>;

  if (mode !== 'normal' && mode !== 'maintenance') {
    return NextResponse.json({ error: 'mode must be "normal" or "maintenance"' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: prev } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'platform_mode')
    .maybeSingle();
  const previousMode = prev?.value ?? 'normal';

  const { error } = await admin
    .from('app_settings')
    .upsert({ key: 'platform_mode', value: mode, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: 'Failed to update platform_mode' }, { status: 500 });
  }

  await logAdminAction(adminUser.id, 'platform_mode_changed', adminUser.id, {
    previous_state: previousMode,
    new_state: mode,
  });

  return NextResponse.json({ ok: true });
}
