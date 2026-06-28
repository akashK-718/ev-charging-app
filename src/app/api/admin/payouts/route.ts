import { NextResponse } from 'next/server';
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

/**
 * GET /api/admin/payouts — list pending payouts with lender info
 */
export async function GET() {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

  const { data: payouts, error } = await adminSupabase
    .from('payouts')
    .select('id, user_id, amount_paise, status, bank_or_upi, booking_ids, created_at, processed_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }

  const rawPayouts = (payouts ?? []) as Array<{
    id: string; user_id: string; amount_paise: number; status: string;
    bank_or_upi: string; booking_ids: string[]; created_at: string; processed_at: string | null;
  }>;

  const userIds = [...new Set(rawPayouts.map(p => p.user_id))];
  const { data: usersData } = userIds.length > 0
    ? await adminSupabase.from('users').select('id, name, phone').in('id', userIds)
    : { data: [] };

  const userMap = new Map(
    ((usersData ?? []) as Array<{ id: string; name: string | null; phone: string }>)
      .map(u => [u.id, u]),
  );

  const enriched = rawPayouts.map(p => ({
    ...p,
    lender: userMap.get(p.user_id) ?? null,
  }));

  return NextResponse.json({ data: enriched });
}
