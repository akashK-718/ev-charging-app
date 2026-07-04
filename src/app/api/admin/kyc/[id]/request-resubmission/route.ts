import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';
import { getAdminUser, logAdminAction } from '@/lib/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as { reason?: string };

  if (!b.reason || typeof b.reason !== 'string' || b.reason.trim().length === 0) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: submission, error: fetchError } = await admin
    .from('kyc_submissions')
    .select('id, user_id, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const sub = submission as { id: string; user_id: string; status: string };

  if (sub.status !== 'pending') {
    return NextResponse.json({ error: 'Submission is not in pending state' }, { status: 409 });
  }

  const { error: updateError } = await admin
    .from('kyc_submissions')
    .update({
      status: 'resubmission_required',
      rejection_reason: b.reason.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUser.id,
    })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to request resubmission' }, { status: 500 });
  }

  await admin
    .from('users')
    .update({ kyc_status: 'resubmission_required' })
    .eq('id', sub.user_id);

  await Promise.all([
    notify(sub.user_id, 'kyc_resubmission_required', {
      submission_id: params.id,
      reason: b.reason.trim(),
    }),
    logAdminAction(adminUser.id, 'kyc_resubmission_required', sub.user_id, {
      submission_id: params.id,
      reason: b.reason.trim(),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
