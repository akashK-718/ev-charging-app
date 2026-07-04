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

  const b = body as { reason?: string; resubmission_allowed?: boolean };

  if (!b.reason || typeof b.reason !== 'string' || b.reason.trim().length === 0) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: submission, error: fetchError } = await adminSupabase
    .from('kyc_submissions')
    .select('id, user_id, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const sub = submission as { id: string; user_id: string; status: string };

  const newStatus = 'rejected';

  const { error: updateSubError } = await adminSupabase
    .from('kyc_submissions')
    .update({
      status: newStatus,
      rejection_reason: b.reason.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUser.id,
    })
    .eq('id', params.id);

  if (updateSubError) {
    return NextResponse.json({ error: 'Failed to reject submission' }, { status: 500 });
  }

  await adminSupabase
    .from('users')
    .update({ kyc_status: 'rejected' })
    .eq('id', sub.user_id);

  await Promise.all([
    notify(sub.user_id, 'kyc_rejected', {
      submission_id: params.id,
      reason: b.reason.trim(),
    }),
    logAdminAction(adminUser.id, 'kyc_rejected', sub.user_id, {
      submission_id: params.id,
      reason: b.reason.trim(),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
