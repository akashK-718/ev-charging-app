// MILESTONE GUARD: only one-time crossings or specific count thresholds qualify.
// If an action can plausibly be performed 10+ times in a day, it MUST NOT trigger
// milestone celebration — only routine success treatment (RoutineSuccess component).
//
// Milestone state is keyed per-user in localStorage under 'kirin:milestones:{userId}'.
// TODO: future DB migration — add milestones_celebrated jsonb column to users
//       for cross-device consistency.

import { createClient } from '@/lib/supabase/client';
import { purgeLegacyKey } from '@/lib/user-storage';

export type MilestoneEvent =
  | 'driver:first_session'
  | 'host:first_charger_published'
  | 'host:first_booking_received'
  | 'host:first_completed_session'
  | 'host:first_payout'
  | 'host:earnings_10k_rupees'
  | 'host:earnings_1L_rupees';

// Future scope — stubs for systems not yet built:
// 'community:referral_milestone'   — needs referral system
// 'community:account_anniversary'  — needs campaign/cron trigger
// 'community:campaign_reward'      — needs campaign system

export const MILESTONE_LABEL: Record<MilestoneEvent, string> = {
  'driver:first_session':          'First charging session complete!',
  'host:first_charger_published':  'Your first charger is live!',
  'host:first_booking_received':   'You got your first booking!',
  'host:first_completed_session':  'First session as a host — great start!',
  'host:first_payout':             'First payout earned!',
  'host:earnings_10k_rupees':      '₹10,000 lifetime earned!',
  'host:earnings_1L_rupees':       '₹1,00,000 lifetime earned!',
};

// ─── Per-user celebration guard ───────────────────────────────────────────────

const STORAGE_KEY_BASE = 'kirin:milestones';

function isCelebrated(event: MilestoneEvent, userId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  // Remove any legacy unscoped key written before user-scoping was introduced.
  purgeLegacyKey(STORAGE_KEY_BASE);
  try {
    const list = JSON.parse(
      localStorage.getItem(`${STORAGE_KEY_BASE}:${userId}`) ?? '[]',
    ) as string[];
    return list.includes(event);
  } catch {
    return false;
  }
}

function markCelebrated(event: MilestoneEvent, userId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = `${STORAGE_KEY_BASE}:${userId}`;
    const list = JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
    if (!list.includes(event)) {
      list.push(event);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch {}
}

// ─── Individual milestone checks ──────────────────────────────────────────────
// User is always resolved before isCelebrated() so the guard reads the correct
// user-scoped key. The early-exit still short-circuits the DB query.

/** Driver: fires once after their very first completed session. */
export async function checkDriverFirstSession(): Promise<MilestoneEvent | null> {
  const event: MilestoneEvent = 'driver:first_session';
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (isCelebrated(event, user.id)) return null;

  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', user.id)
    .eq('status', 'completed');

  if (count === 1) {
    markCelebrated(event, user.id);
    return event;
  }
  return null;
}

/** Host: fires once when their first charger transitions out of draft. */
export async function checkHostFirstChargerPublished(): Promise<MilestoneEvent | null> {
  const event: MilestoneEvent = 'host:first_charger_published';
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (isCelebrated(event, user.id)) return null;

  const { count } = await supabase
    .from('chargers')
    .select('id', { count: 'exact', head: true })
    .eq('lender_id', user.id)
    .neq('status', 'draft')
    .is('deleted_at', null);

  if (count === 1) {
    markCelebrated(event, user.id);
    return event;
  }
  return null;
}

/** Host: fires once when they receive their first confirmed booking. */
export async function checkHostFirstBookingReceived(): Promise<MilestoneEvent | null> {
  const event: MilestoneEvent = 'host:first_booking_received';
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (isCelebrated(event, user.id)) return null;

  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('lender_id', user.id)
    .not('status', 'in', '(pending,rejected,auto_rejected,cancelled)');

  if (count === 1) {
    markCelebrated(event, user.id);
    return event;
  }
  return null;
}

/** Host: fires once after their first booking reaches completed status. */
export async function checkHostFirstCompletedSession(): Promise<MilestoneEvent | null> {
  const event: MilestoneEvent = 'host:first_completed_session';
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (isCelebrated(event, user.id)) return null;

  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('lender_id', user.id)
    .eq('status', 'completed');

  if (count === 1) {
    markCelebrated(event, user.id);
    return event;
  }
  return null;
}

/**
 * Host: fires when a payout transitions to completed for the first time,
 * or when cumulative earnings cross ₹10k or ₹1L.
 *
 * NOTE: Real-time payout detection via polling is unsafe (race conditions, multiple
 * triggers). This function is called from the payouts page on explicit user refresh.
 * Push-notification-triggered milestone celebration is flagged as future scope.
 */
export async function checkHostPayoutMilestones(): Promise<MilestoneEvent | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: payoutsRaw, count: payoutCount } = await supabase
    .from('payouts')
    .select('amount_paise', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('status', 'completed');

  const payouts = payoutsRaw as { amount_paise: number }[] | null;

  const firstPayoutEvent: MilestoneEvent = 'host:first_payout';
  if (payoutCount === 1 && !isCelebrated(firstPayoutEvent, user.id)) {
    markCelebrated(firstPayoutEvent, user.id);
    return firstPayoutEvent;
  }

  const totalRupees = ((payouts ?? []).reduce((s, p) => s + (p.amount_paise ?? 0), 0)) / 100;

  const oneL: MilestoneEvent = 'host:earnings_1L_rupees';
  if (totalRupees >= 100000 && !isCelebrated(oneL, user.id)) {
    markCelebrated(oneL, user.id);
    return oneL;
  }

  const tenK: MilestoneEvent = 'host:earnings_10k_rupees';
  if (totalRupees >= 10000 && !isCelebrated(tenK, user.id)) {
    markCelebrated(tenK, user.id);
    return tenK;
  }

  return null;
}
