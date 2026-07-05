import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';
import { getAdminUser, logAdminAction } from '@/lib/admin';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

  const { data: submission, error: fetchError } = await adminSupabase
    .from('kyc_submissions')
    .select('id, user_id, status, selfie_url')
    .eq('id', params.id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const sub = submission as { id: string; user_id: string; status: string; selfie_url: string };

  if (sub.status !== 'pending') {
    return NextResponse.json({ error: 'Submission is not in pending state' }, { status: 409 });
  }

  const { error: updateSubError } = await adminSupabase
    .from('kyc_submissions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUser.id,
    })
    .eq('id', params.id);

  if (updateSubError) {
    return NextResponse.json({ error: 'Failed to approve submission' }, { status: 500 });
  }

  await adminSupabase
    .from('users')
    .update({ kyc_status: 'approved' })
    .eq('id', sub.user_id);

  // One-time avatar backfill: copy selfie into avatar_url if user hasn't set one yet
  if (sub.selfie_url) {
    const { data: userData } = await adminSupabase
      .from('users')
      .select('avatar_url')
      .eq('id', sub.user_id)
      .single();
    const u = userData as { avatar_url: string | null } | null;
    if (!u?.avatar_url) {
      await adminSupabase
        .from('users')
        .update({ avatar_url: sub.selfie_url })
        .eq('id', sub.user_id);
    }
  }

  // Promote all draft chargers for this lender to active — they go live immediately.
  await adminSupabase
    .from('chargers')
    .update({ status: 'active' })
    .eq('lender_id', sub.user_id)
    .eq('status', 'draft')
    .is('deleted_at', null);

  await Promise.all([
    notify(sub.user_id, 'kyc_approved', { submission_id: params.id }),
    logAdminAction(adminUser.id, 'kyc_approved', sub.user_id, { submission_id: params.id }),
  ]);

  return NextResponse.json({ ok: true });
}
