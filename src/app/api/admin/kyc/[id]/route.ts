import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: submission, error } = await admin
    .from('kyc_submissions')
    .select('id, user_id, aadhaar_photo_url, pan_photo_url, selfie_url, pan_number, aadhaar_last_4, bank_account_number, bank_ifsc, upi_id, status, submitted_at, rejection_reason')
    .eq('id', params.id)
    .single();

  if (error || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const sub = submission as {
    id: string; user_id: string; aadhaar_photo_url: string; pan_photo_url: string;
    selfie_url: string; pan_number: string; aadhaar_last_4: string;
    bank_account_number: string | null; bank_ifsc: string | null; upi_id: string | null;
    status: string; submitted_at: string; rejection_reason: string | null;
  };

  const [userRes, draftsRes] = await Promise.all([
    admin.from('users').select('phone, name, role, created_at').eq('id', sub.user_id).single(),
    admin.from('chargers').select('id', { count: 'exact', head: true }).eq('lender_id', sub.user_id).eq('status', 'draft').is('deleted_at', null),
  ]);

  return NextResponse.json({
    data: {
      ...sub,
      users: userRes.data ?? null,
      draft_count: draftsRes.count ?? 0,
    },
  });
}
