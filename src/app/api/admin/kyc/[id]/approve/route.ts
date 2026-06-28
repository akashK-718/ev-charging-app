import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';

async function getAdminUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile as { role: string }).role !== 'admin') return null;
  return user;
}

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

  await notify(sub.user_id, 'kyc_approved', { submission_id: params.id });

  return NextResponse.json({ ok: true });
}
