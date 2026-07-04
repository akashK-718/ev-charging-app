import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/admin';

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'resubmission_required'] as const;
type KycStatus = (typeof VALID_STATUSES)[number];

export async function GET(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status') ?? 'pending';

  const adminSupabase = createAdminClient();

  let submissionsQuery = adminSupabase
    .from('kyc_submissions')
    .select('id, user_id, pan_number, aadhaar_last_4, status, submitted_at, rejection_reason')
    .order('submitted_at', { ascending: true });

  if (statusParam !== 'all' && VALID_STATUSES.includes(statusParam as KycStatus)) {
    submissionsQuery = submissionsQuery.eq('status', statusParam as KycStatus);
  }

  const { data: submissions, error } = await submissionsQuery;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch KYC submissions' }, { status: 500 });
  }

  const rawList = (submissions ?? []) as Array<{
    id: string; user_id: string; pan_number: string; aadhaar_last_4: string;
    status: string; submitted_at: string; rejection_reason: string | null;
  }>;

  const userIds = [...new Set(rawList.map(s => s.user_id))];

  const [usersRes, draftsRes] = await Promise.all([
    userIds.length > 0
      ? adminSupabase.from('users').select('id, phone, name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? adminSupabase.from('chargers').select('lender_id').eq('status', 'draft').is('deleted_at', null).in('lender_id', userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const userMap = new Map(
    ((usersRes.data ?? []) as Array<{ id: string; phone: string; name: string | null }>)
      .map(u => [u.id, { phone: u.phone, name: u.name }]),
  );

  const draftCountMap = new Map<string, number>();
  for (const row of (draftsRes.data ?? []) as Array<{ lender_id: string }>) {
    draftCountMap.set(row.lender_id, (draftCountMap.get(row.lender_id) ?? 0) + 1);
  }

  const enriched = rawList.map(s => ({
    ...s,
    users: userMap.get(s.user_id) ?? null,
    draft_count: draftCountMap.get(s.user_id) ?? 0,
  }));

  return NextResponse.json({ data: enriched });
}
