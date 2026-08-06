import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getRazorpay } from '@/lib/razorpay';

/**
 * DELETE /api/payments/saved-methods/[tokenId]
 *
 * Removes a saved payment token from the user's Razorpay customer record.
 * If the deleted token was the user's default, clears default_payment_token_id.
 *
 * razorpay_customer_id and default_payment_token_id are added via migration 033
 * and are not yet in the generated Supabase types, so we use `any` casts.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { tokenId: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { tokenId } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: userRow } = await admin
    .from('users')
    .select('razorpay_customer_id, default_payment_token_id')
    .eq('id', user.id)
    .single();

  const row = userRow as { razorpay_customer_id: string | null; default_payment_token_id: string | null } | null;
  if (!row?.razorpay_customer_id) {
    return NextResponse.json({ error: 'No payment methods on file' }, { status: 404 });
  }

  try {
    await getRazorpay().customers.deleteToken(row.razorpay_customer_id, tokenId);
  } catch (err) {
    console.warn('[saved-methods/delete] Razorpay error:', err);
    return NextResponse.json({ error: 'Failed to remove payment method' }, { status: 502 });
  }

  // Clear default if this was the default token
  if (row.default_payment_token_id === tokenId) {
    await admin.from('users').update({ default_payment_token_id: null }).eq('id', user.id);
  }

  return NextResponse.json({ success: true });
}
