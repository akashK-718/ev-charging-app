/**
 * App-wide constants — change values here, not scattered in code.
 */

// Platform commission (percentage of total session value)
export const PLATFORM_COMMISSION_PERCENT = 15;

// Booking auto-cancel if not confirmed by lender within this many minutes
export const BOOKING_AUTO_CANCEL_MINUTES = 30;

// Hold payment for this long after session completion before releasing to lender
export const PAYOUT_HOLD_HOURS = 24;

// Free cancellation window for driver (minutes before scheduled start)
export const FREE_CANCEL_MINUTES = 60;

// Free cancellation window post-payment (minutes after payment captured)
export const FREE_CANCEL_WINDOW_MINUTES = 5;

// "Start session" button appears this many minutes before scheduled_start,
// and remains valid this many minutes after scheduled_end (grace window).
export const SESSION_GRACE_MINUTES = 30;

// Default search radius for "nearby chargers" (in meters)
export const DEFAULT_SEARCH_RADIUS_METERS = 5000;

// Connector types available in India
export const CONNECTOR_TYPES = [
  'Type2',
  'BharatAC',
  'CCS2',
  'CHAdeMO',
  'Type1'
] as const;

export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

// Charger power categories
export const CHARGER_TYPES = [
  { value: 'AC_3.3kW', label: '3.3 kW · AC' },
  { value: 'AC_7kW', label: '7 kW · AC' },
  { value: 'AC_22kW', label: '22 kW · AC' },
  { value: 'DC_fast', label: 'DC Fast' }
] as const;

// Booking states (the state machine)
export const BOOKING_STATES = [
  'pending',                      // created, awaiting lender accept
  'confirmed',                    // lender accepted
  'rejected',                     // lender manually rejected
  'auto_rejected',                // 30-min timeout
  'cancelled',                    // driver cancelled (future PR)
  'awaiting_driver_confirmation', // lender initiated session, driver must confirm
  'in_progress',                  // session started (both parties confirmed)
  'completed',                    // session ended successfully
  'no_show'                       // driver didn't show up (future PR)
] as const;

export type BookingStatus = (typeof BOOKING_STATES)[number];

// Statuses considered "active" — shown in default lists, eligible for polling
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'awaiting_driver_confirmation', 'in_progress'];

// Statuses considered "declined" — driver-facing message + refund already triggered
export const DECLINED_BOOKING_STATUSES: BookingStatus[] = ['rejected', 'auto_rejected', 'cancelled'];

// Statuses considered "past" — lifecycle finished
export const PAST_BOOKING_STATUSES: BookingStatus[] = ['completed', 'no_show'];

// Proximity check — server fallback defaults (never fail open)
export const PROXIMITY_CHECK_DEFAULTS = { enabled: true, radius_km: 0.5 } as const;

// Valid radius options surfaced in the admin UI
export const PROXIMITY_RADIUS_STEPS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;
