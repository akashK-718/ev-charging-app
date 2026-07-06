import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/lender/chargers
 * Returns chargers owned by the authenticated lender (excluding soft-deleted).
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['lender', 'both'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only lenders can view their chargers' }, { status: 403 });
  }

  const { data: chargers, error } = await adminSupabase
    .from('chargers')
    .select('id, title, address, price_per_kwh, status, total_sessions, charger_type, connector_types, photos, avg_rating, created_at')
    .eq('lender_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch chargers' }, { status: 500 });
  }

  return NextResponse.json({ data: chargers ?? [] });
}
