import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateConfirmationCode } from '@/lib/utils';

/**
 * POST /api/bookings — create a new booking.
 * GET /api/bookings — list current user's bookings.
 *
 * TODO (Milestone 3):
 *   - validate slot availability (SELECT FOR UPDATE to prevent double-booking)
 *   - insert booking row with status='pending'
 *   - notify lender
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createClient();

  // Placeholder skeleton — see Milestone 3 for full implementation.
  return NextResponse.json({
    ok: true,
    confirmationCode: generateConfirmationCode()
  });
}

export async function GET() {
  const supabase = createClient();
  // TODO: filter by current user, paginate
  return NextResponse.json({ bookings: [] });
}
