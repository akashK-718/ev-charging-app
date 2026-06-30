import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Allows letters (including Unicode for Indian scripts) and spaces, 2–50 chars
const NAME_REGEX = /^[\p{L}\s]{2,50}$/u;
const VALID_ROLES = ['driver', 'lender', 'both'] as const;
type Role = (typeof VALID_ROLES)[number];

function validateName(v: unknown): string | null {
  if (typeof v !== 'string') return 'Name is required.';
  const trimmed = v.trim();
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (trimmed.length > 50) return 'Name must be 50 characters or fewer.';
  if (!NAME_REGEX.test(trimmed)) return 'Name can only contain letters and spaces.';
  return null;
}

export async function PATCH(request: NextRequest) {
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

  const b = body as Record<string, unknown>;

  // Reject phone changes — full flow requires dual OTP verification, uniqueness check, auth sync
  // TODO: Implement phone change flow in future PR (Module 5+)
  // Requires: OTP verification on both numbers, uniqueness check, auth provider sync
  if ('phone' in b) {
    return NextResponse.json(
      { error: 'Phone changes are not supported via this endpoint. Contact support.' },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const updates: { name?: string; role?: 'driver' | 'lender' | 'both' } = {};
  const metaUpdates: { name?: string; role?: string; onboarded?: boolean } = {};
  let roleForcedBoth = false;

  // ── Name update ─────────────────────────────────────────────────────────────
  if ('name' in b) {
    const nameError = validateName(b.name);
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });
    const trimmedName = (b.name as string).trim();
    updates.name = trimmedName;
    metaUpdates.name = trimmedName;
  }

  // ── Role update ──────────────────────────────────────────────────────────────
  if ('role' in b) {
    const newRole = b.role;
    if (typeof newRole !== 'string' || !VALID_ROLES.includes(newRole as Role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be driver, lender, or both.' },
        { status: 400 },
      );
    }

    const requestedRole = newRole as Role;

    // Fetch current role to check if transition requires charger guard
    const { data: currentUser } = await adminSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const currentRole = (currentUser?.role ?? 'driver') as Role;

    // Role transition rules:
    // Lender/Both → Driver: blocked if user has any non-deleted chargers (force Both instead).
    // All other transitions are always allowed.
    let resolvedRole = requestedRole;

    if (
      requestedRole === 'driver' &&
      (currentRole === 'lender' || currentRole === 'both')
    ) {
      const { count } = await adminSupabase
        .from('chargers')
        .select('id', { count: 'exact', head: true })
        .eq('lender_id', user.id)
        .is('deleted_at', null)
        .in('status', ['draft', 'active', 'paused']);

      if ((count ?? 0) > 0) {
        // Cannot fully switch to driver while chargers exist — force Both
        resolvedRole = 'both';
        roleForcedBoth = true;
      }
    }

    updates.role = resolvedRole;
    metaUpdates.role = resolvedRole;
    // Choosing a role (welcome flow or later editing) marks onboarding complete.
    metaUpdates.onboarded = true;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }

  const { error: updateError } = await adminSupabase
    .from('users')
    .update(updates)
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Could not save changes. Please try again.' }, { status: 500 });
  }

  // Keep JWT metadata in sync so useAuth fast-path works correctly
  if (Object.keys(metaUpdates).length > 0) {
    await adminSupabase.auth.admin.updateUserById(user.id, {
      user_metadata: metaUpdates,
    });
  }

  return NextResponse.json({
    data: updates,
    ...(roleForcedBoth ? { roleForcedBoth: true } : {}),
  });
}
