import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

/**
 * Returns the Supabase auth User if the caller has is_admin = true, otherwise null.
 * Always validates against the DB — never trusts JWT metadata alone.
 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!(profile as { is_admin: boolean } | null)?.is_admin) return null;
  return user;
}

/** Appends a row to audit_log. Failures are intentionally swallowed — auditing must never break primary flows. */
export async function logAdminAction(
  adminUserId: string,
  actionType: string,
  targetUserId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('audit_log').insert({
      admin_user_id: adminUserId,
      action_type: actionType,
      target_user_id: targetUserId,
      metadata,
    });
  } catch {
    // Non-fatal
  }
}
