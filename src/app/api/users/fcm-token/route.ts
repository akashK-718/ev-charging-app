import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * POST /api/users/fcm-token
 * Saves the FCM push token for the authenticated user.
 * Called on every app load — handles token rotation automatically.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const token = (body as Record<string, unknown>).token;
  if (typeof token !== 'string' || token.length < 10) {
    return NextResponse.json({ error: 'Invalid FCM token' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from('users')
    .update({ fcm_token: token })
    .eq('id', user.id);

  if (error) {
    console.error('[fcm-token] Failed to save token:', error);
    return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
