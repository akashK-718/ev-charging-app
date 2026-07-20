import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runAutoRejectSweep } from '@/lib/bookings/auto-reject';
import { runNoShowWarningSweep, runNoShowTimeoutSweep } from '@/lib/bookings/no-show-sweep';
import { runFlagForReviewSweep } from '@/lib/bookings/flag-for-review';

// Secret must match the value configured in app_settings.lifecycle_sweep.secret
// and set as LIFECYCLE_SWEEP_SECRET in the Vercel environment.
const INTERNAL_SECRET = process.env.LIFECYCLE_SWEEP_SECRET;

/**
 * POST /api/internal/lifecycle-sweep
 *
 * Called every minute by pg_cron via pg_net. Runs all booking lifecycle sweeps:
 * 1. Auto-reject pending requests not responded to within 30 min.
 * 2. No-show warning push to host at T+25 min.
 * 3. No-show auto-transition at T+30 min (or extension expiry or T+60 hard cutoff).
 * 4. Flag sessions stuck in awaiting_end_confirmation for admin review.
 *
 * Authenticated via x-internal-secret header — not exposed to users.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-internal-secret');
  if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const results = await Promise.allSettled([
    runAutoRejectSweep(admin),
    runNoShowWarningSweep(admin),
    runNoShowTimeoutSweep(admin),
    runFlagForReviewSweep(admin),
  ]);

  const errors = results
    .filter(r => r.status === 'rejected')
    .map(r => (r as PromiseRejectedResult).reason?.message ?? 'unknown error');

  if (errors.length > 0) {
    console.error('[lifecycle-sweep] sweep errors:', errors);
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ran: ['auto-reject', 'noshow-warning', 'noshow-timeout', 'flag-for-review'],
  });
}
