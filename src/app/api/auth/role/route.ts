import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const VALID_ROLES = ['driver', 'lender', 'both'] as const;
type Role = (typeof VALID_ROLES)[number];

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const role = (body as Record<string, unknown>)?.role;
  if (typeof role !== 'string' || !VALID_ROLES.includes(role as Role)) {
    return NextResponse.json(
      { error: 'Invalid role. Must be driver, lender, or both.' },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();

  const { error: updateError } = await adminSupabase
    .from('users')
    .update({ role: role as Role })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json(
      { error: 'Could not save your choice. Please try again.' },
      { status: 500 },
    );
  }

  // Sync role into user_metadata so middleware and useAuth can read it from the JWT
  // without an extra DB round-trip.
  await adminSupabase.auth.admin.updateUserById(user.id, {
    user_metadata: { role },
  });

  return NextResponse.json({ data: { role } });
}
