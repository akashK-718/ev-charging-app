import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Allows letters (including Unicode for Indian scripts) and spaces, 2–50 chars
const NAME_REGEX = /^[\p{L}\s]{2,50}$/u;

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

  const name = (body as Record<string, unknown>)?.name;
  const nameError = validateName(name);
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 });
  }

  const trimmedName = (name as string).trim();
  const adminSupabase = createAdminClient();

  const { error: updateError } = await adminSupabase
    .from('users')
    .update({ name: trimmedName })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Could not save name. Please try again.' }, { status: 500 });
  }

  // Keep user_metadata in sync
  await adminSupabase.auth.admin.updateUserById(user.id, {
    user_metadata: { name: trimmedName },
  });

  return NextResponse.json({ data: { name: trimmedName } });
}
