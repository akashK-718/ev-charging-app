import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeMaxEndTime } from '@/lib/bookings/availability';

/**
 * GET /api/chargers/[id]/availability-window?start=<ISO>
 *
 * Returns the latest valid end time for a new booking on this charger
 * starting at `start`, plus a human-readable reason for the cap.
 * Used by the booking UI to constrain the duration picker.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const startParam = request.nextUrl.searchParams.get('start');
  if (!startParam) {
    return NextResponse.json({ error: 'start query param is required' }, { status: 400 });
  }

  const start = new Date(startParam);
  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: 'Invalid start time' }, { status: 400 });
  }

  const { maxEnd, reason } = await computeMaxEndTime(params.id, start);

  return NextResponse.json({ data: { max_end: maxEnd.toISOString(), reason } });
}
