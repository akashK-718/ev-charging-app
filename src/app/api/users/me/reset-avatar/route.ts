import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(_request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // Only approved lenders may use this endpoint
  const { data: userData } = await adminSupabase
    .from('users')
    .select('kyc_status')
    .eq('id', user.id)
    .single();

  const u = userData as { kyc_status: string } | null;
  if (u?.kyc_status !== 'approved') {
    return NextResponse.json({ error: 'Only verified lenders can use this option' }, { status: 403 });
  }

  // Fetch selfie from the most recent approved submission
  const { data: submission } = await adminSupabase
    .from('kyc_submissions')
    .select('selfie_url')
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sub = submission as { selfie_url: string } | null;
  if (!sub?.selfie_url) {
    return NextResponse.json({ error: 'No approved KYC submission found' }, { status: 404 });
  }

  const { error: updateError } = await adminSupabase
    .from('users')
    .update({ avatar_url: sub.selfie_url })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update avatar' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, avatar_url: sub.selfie_url });
}
