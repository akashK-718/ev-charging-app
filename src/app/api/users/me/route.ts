import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

function isValidCloudinaryUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
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
  const updates: { avatar_url?: string | null } = {};

  if ('avatar_url' in b) {
    const url = b.avatar_url;
    if (url === null) {
      updates.avatar_url = null;
    } else if (typeof url === 'string' && isValidCloudinaryUrl(url)) {
      updates.avatar_url = url;
    } else {
      return NextResponse.json(
        { error: 'avatar_url must be a valid Cloudinary URL or null' },
        { status: 400 },
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { data: updated, error: updateError } = await adminSupabase
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select('id, avatar_url')
    .single();

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: updated });
}
