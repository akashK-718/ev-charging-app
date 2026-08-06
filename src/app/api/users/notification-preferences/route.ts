import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

type PrefsRow = {
  booking_updates: boolean;
  charging_reminders: boolean;
  hosting_activity: boolean;
  kyc_updates: boolean;
  payments_payouts: boolean;
  product_announcements: boolean;
  promotions_offers: boolean;
};

const DEFAULTS: PrefsRow = {
  booking_updates: true,
  charging_reminders: true,
  hosting_activity: true,
  kyc_updates: true,
  payments_payouts: true,
  product_announcements: true,
  promotions_offers: false,
};

const ALLOWED_KEYS = new Set(Object.keys(DEFAULTS));

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from('notification_preferences')
    .select('booking_updates,charging_reminders,hosting_activity,kyc_updates,payments_payouts,product_announcements,promotions_offers')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ data: data ?? DEFAULTS });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update = body as Record<string, unknown>;

  // Only accept known toggleable preference keys, values must be boolean.
  const validated: Partial<PrefsRow> = {};
  for (const [k, v] of Object.entries(update)) {
    if (!ALLOWED_KEYS.has(k) || typeof v !== 'boolean') {
      return NextResponse.json({ error: `Invalid field: ${k}` }, { status: 400 });
    }
    (validated as Record<string, boolean>)[k] = v;
  }

  if (Object.keys(validated).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminSupabase as any)
    .from('notification_preferences')
    .upsert(
      { user_id: user.id, ...validated, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
