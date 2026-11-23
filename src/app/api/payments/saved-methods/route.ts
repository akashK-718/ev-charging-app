import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { fetchSavedMethods } from '@/lib/payments/saved-methods.server';

/** Return saved tokens, creating the authenticated user's customer if needed. */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('name, phone, razorpay_customer_id, default_payment_token_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const result = await fetchSavedMethods(admin, user.id, profile);
  return NextResponse.json({ ...result, defaultTokenId: profile.default_payment_token_id });
}
