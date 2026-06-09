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
  'pending',
  'confirmed',
  'active',
  'completed',
  'cancelled',
  'disputed'
] as const;

export type BookingStatus = (typeof BOOKING_STATES)[number];
