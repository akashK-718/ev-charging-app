import { createAdminClient } from '@/lib/supabase/server';
import {
  PLATFORM_MAX_BOOKING_DURATION_HOURS,
  BOOKING_BUFFER_MINUTES,
  ACTIVE_BOOKING_STATUSES,
} from '@/lib/constants';

// Single call sites for the two Phase-2 deferral constants.
// When either is promoted to a live admin-configurable value (via app_settings
// or Edge Config), change only these functions — not every caller.
export function getPlatformMaxBookingDurationHours(): number {
  return PLATFORM_MAX_BOOKING_DURATION_HOURS;
}

export function getBookingBufferMinutes(): number {
  return BOOKING_BUFFER_MINUTES;
}

export interface AvailabilityWindow {
  maxEnd: Date;
  /** Human-readable reason why maxEnd is capped (shown to the driver). */
  reason: string;
}

/**
 * Compute the latest valid end time for a new booking on `chargerId` starting
 * at `start`. Returns the minimum of:
 *
 *   min(
 *     start + PLATFORM_MAX_BOOKING_DURATION_HOURS,
 *     next_active_booking.scheduled_start − BOOKING_BUFFER_MINUTES
 *   )
 *
 * `pending` counts as blocking — prevents two drivers racing for the same slot
 * before a host has responded.
 *
 * NOTE: Chargers have an `availability_slots` table (day_of_week, start_time,
 * end_time) that represents the lender's declared operating hours, but this
 * table is currently not enforced during booking creation — bookings at any
 * hour are accepted by the API. Enforcing the availability window is deferred;
 * it is treated here as "no per-day constraint." See PR description.
 */
export async function computeMaxEndTime(
  chargerId: string,
  start: Date,
): Promise<AvailabilityWindow> {
  const platformMax = new Date(
    start.getTime() + getPlatformMaxBookingDurationHours() * 60 * 60 * 1000,
  );

  const supabase = createAdminClient();

  const { data: nextBooking } = await supabase
    .from('bookings')
    .select('scheduled_start')
    .eq('charger_id', chargerId)
    .in('status', ACTIVE_BOOKING_STATUSES)
    .gt('scheduled_start', start.toISOString())
    .order('scheduled_start', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextBooking) {
    return {
      maxEnd: platformMax,
      reason: `Maximum booking length is ${getPlatformMaxBookingDurationHours()} hours`,
    };
  }

  const bufferMs = getBookingBufferMinutes() * 60 * 1000;
  const nextStart = new Date(nextBooking.scheduled_start);
  const bookingCap = new Date(nextStart.getTime() - bufferMs);

  if (bookingCap < platformMax) {
    return { maxEnd: bookingCap, reason: formatNextBookingReason(nextStart, start) };
  }

  return {
    maxEnd: platformMax,
    reason: `Maximum booking length is ${getPlatformMaxBookingDurationHours()} hours`,
  };
}

function formatNextBookingReason(nextStart: Date, currentStart: Date): string {
  const h = nextStart.getHours();
  const m = nextStart.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const timeStr = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;

  const isSameDay =
    nextStart.getFullYear() === currentStart.getFullYear() &&
    nextStart.getMonth() === currentStart.getMonth() &&
    nextStart.getDate() === currentStart.getDate();

  if (isSameDay) return `Charger is booked again at ${timeStr}`;

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `Charger is booked again at ${timeStr} on ${months[nextStart.getMonth()]} ${nextStart.getDate()}`;
}
