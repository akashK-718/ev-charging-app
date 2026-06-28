import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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

  if (!profile || profile.role !== 'admin') return null;
  return user;
}

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

  // Enrich with user info
  const userIds = [...new Set(rawList.map(s => s.user_id))];
  const { data: usersData } = userIds.length > 0
    ? await adminSupabase.from('users').select('id, phone, name').in('id', userIds)
    : { data: [] };

  const userMap = new Map(
    (usersData ?? []).map(u => [u.id, { phone: u.phone, name: u.name }] as [string, { phone: string; name: string | null }]),
  );

  const enriched = rawList.map(s => ({
    ...s,
    users: userMap.get(s.user_id) ?? null,
  }));

  return NextResponse.json({ data: enriched });
}
