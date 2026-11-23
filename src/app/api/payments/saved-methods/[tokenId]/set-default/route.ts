import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * POST /api/payments/saved-methods/[tokenId]/set-default
 *
 * Marks a saved payment token as the user's preferred default method.
 * Stored locally on users.default_payment_token_id — Razorpay has no
 * server-side "default" concept for tokens.
 *
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { tokenId: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { tokenId } = params;

  const admin = createAdminClient();
  await admin.from('users').update({ default_payment_token_id: tokenId }).eq('id', user.id);

  return NextResponse.json({ success: true });
}
