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

type OperatingSlot = { day_of_week: number[]; start_time: string; end_time: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

function timeOfDayMs(time: string) {
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

// Host hours recur in India Standard Time. Merge touching windows so the
// all-day preset and adjacent shifts form one continuous booking window.
export function operatingWindow(slots: OperatingSlot[], start: Date, platformMax: Date): AvailabilityWindow {
  const localStart = new Date(start.getTime() + IST_OFFSET_MS);
  const midnight = Math.floor(localStart.getTime() / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  const intervals: { from: number; to: number }[] = [];
  for (let day = -1; midnight + day * DAY_MS <= platformMax.getTime(); day++) {
    const weekday = (localStart.getUTCDay() + day + 7) % 7;
    for (const slot of slots) {
      if (!slot.day_of_week.includes(weekday)) continue;
      const opens = timeOfDayMs(slot.start_time);
      let closes = timeOfDayMs(slot.end_time);
      if (opens === closes) continue;
      if (opens === 0 && closes === DAY_MS - 60000) closes = DAY_MS;
      if (closes < opens) closes += DAY_MS;
      const base = midnight + day * DAY_MS;
      intervals.push({ from: base + opens, to: base + closes });
    }
  }
  let end = start.getTime();
  for (const interval of intervals.sort((a, b) => a.from - b.from)) {
    if (interval.from > end) break;
    end = Math.max(end, interval.to);
  }
  if (end === start.getTime()) return { maxEnd: start, reason: 'The host is closed at this time' };
  if (end < platformMax.getTime()) {
    const time = new Date(end).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
    return { maxEnd: new Date(end), reason: `Host hours end at ${time} IST` };
  }
  return { maxEnd: platformMax, reason: `Maximum booking length is ${getPlatformMaxBookingDurationHours()} hours` };
}

export async function computeMaxEndTime(
  chargerId: string,
  start: Date,
): Promise<AvailabilityWindow> {
  const platformMax = new Date(
    start.getTime() + getPlatformMaxBookingDurationHours() * 60 * 60 * 1000,
  );

  const supabase = createAdminClient();

  const bufferMs = getBookingBufferMinutes() * 60 * 1000;
  const [hours, booking] = await Promise.all([
    supabase.from('availability_slots').select('day_of_week, start_time, end_time').eq('charger_id', chargerId).eq('is_active', true),
    supabase
      .from('bookings')
      .select('scheduled_start')
      .eq('charger_id', chargerId)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .gt('scheduled_end', new Date(start.getTime() - bufferMs).toISOString())
      .order('scheduled_start', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (hours.error || booking.error) throw new Error('Could not check availability');
  const window = operatingWindow(hours.data ?? [], start, platformMax);
  const nextBooking = booking.data;
  if (!nextBooking || window.maxEnd <= start) return window;

  const nextStart = new Date(nextBooking.scheduled_start);
  const bookingCap = new Date(nextStart.getTime() - bufferMs);

  if (bookingCap <= start) return { maxEnd: start, reason: 'This start time is already reserved' };

  if (bookingCap < window.maxEnd) {
    return { maxEnd: bookingCap, reason: formatNextBookingReason(nextStart, start) };
  }

  return window;
}

function formatNextBookingReason(nextStart: Date, currentStart: Date): string {
  const options = { timeZone: 'Asia/Kolkata' };
  const time = nextStart.toLocaleTimeString('en-IN', { ...options, hour: 'numeric', minute: '2-digit' });
  const sameDay = nextStart.toLocaleDateString('en-IN', options) === currentStart.toLocaleDateString('en-IN', options);
  const day = sameDay ? '' : ' on ' + nextStart.toLocaleDateString('en-IN', { ...options, day: 'numeric', month: 'short' });
  return `Charger is booked again at ${time} IST${day}`;
}
