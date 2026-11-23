import type { ActivityKind, HistoryItem } from '../../types/activity';

export function historyItemKind(item: HistoryItem): ActivityKind {
  if (item.kind === 'charging') {
    if (item.status === 'completed')   return 'payment';
    if (item.status === 'in_progress') return 'session';
    return 'booking';
  }
  // hosting
  if (item.status === 'completed') return 'payout';
  return 'host';
}

export function notifItemKind(type: string): ActivityKind {
  if (type === 'payout_processed')  return 'payout';
  if (type.startsWith('booking_'))  return 'booking';
  if (type.startsWith('session_'))  return 'session';
  return 'notice';
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function driverAmountDisplay(item: HistoryItem): string | null {
  if (item.status === 'cancelled' || item.status === 'auto_reject') return null;
  if (item.displayAmountPaise !== null && item.displayAmountPaise >= 0) {
    return `Paid \u20B9${(item.displayAmountPaise / 100).toFixed(2)}`;
  }
  return null;
}

export function hostAmountDisplay(item: HistoryItem): string | null {
  if (item.status !== 'completed') return null;
  if (item.displayAmountPaise !== null && item.displayAmountPaise >= 0) {
    return `Earned \u20B9${(item.displayAmountPaise / 100).toFixed(2)}`;
  }
  return null;
}

export function sessionEyebrow(item: HistoryItem): string {
  const { status, roleInSession } = item;
  if (['pending', 'confirmed', 'awaiting_driver_confirmation'].includes(status)) {
    return roleInSession === 'driver' ? 'UPCOMING CHARGE' : 'UPCOMING GUEST';
  }
  if (status === 'in_progress' || status === 'awaiting_end_confirmation') {
    return roleInSession === 'driver' ? "YOU'RE CHARGING" : "YOU'RE HOSTING";
  }
  if (status === 'completed') {
    return roleInSession === 'driver' ? 'YOU CHARGED' : 'YOU HOSTED';
  }
  return roleInSession === 'driver' ? 'CHARGE CANCELLED' : 'HOSTING CANCELLED';
}

// ── Status display ────────────────────────────────────────────────────────────

export const DRIVER_STATUS_LABEL: Record<string, string> = {
  pending:                      'Awaiting confirmation',
  confirmed:                    'Confirmed',
  awaiting_driver_confirmation: 'Ready to start',
  in_progress:                  'Charging in progress',
  awaiting_end_confirmation:    'Ready to end',
  completed:                    'Completed',
  cancelled:                    'Cancelled',
  no_show:                      'No show',
  auto_reject:                  'Not accepted',
};

export const HOST_STATUS_LABEL: Record<string, string> = {
  pending:                      'Awaiting your approval',
  confirmed:                    'Booking confirmed',
  awaiting_driver_confirmation: 'Waiting for driver',
  in_progress:                  'Guest charging',
  awaiting_end_confirmation:    'Waiting to end session',
  completed:                    'Completed',
  cancelled:                    'Cancelled',
  no_show:                      "Driver didn't arrive",
  auto_reject:                  'Auto-rejected',
};

// GreenPath pill colors: amber for action-needed, green-soft for neutral, danger for cancelled
export const STATUS_COLOR: Record<string, string> = {
  pending:                      'bg-amber-100 text-amber-700',
  confirmed:                    'bg-green-soft text-green',
  awaiting_driver_confirmation: 'bg-amber-100 text-amber-700',
  in_progress:                  'bg-green-soft text-green',
  awaiting_end_confirmation:    'bg-amber-100 text-amber-700',
  completed:                    'bg-surface-page text-muted',
  cancelled:                    'bg-danger-soft text-danger',
  no_show:                      'bg-danger-soft text-danger',
  auto_reject:                  'bg-surface-page text-muted',
};

// ── Notification display ──────────────────────────────────────────────────────

export const NOTIF_LABEL: Record<string, string> = {
  booking_received:             'New booking request',
  booking_accepted:             'Booking confirmed',
  booking_rejected:             'Booking declined',
  booking_auto_rejected:        'Booking expired',
  booking_cancelled:            'Booking cancelled',
  booking_no_show:              'No-show recorded',
  session_initiation_requested: 'Session start requested',
  session_started:              'Session started',
  session_end_requested:        'Session end requested',
  session_completed:            'Session completed',
  kyc_approved:                 'Verification approved',
  kyc_rejected:                 'Verification rejected',
  kyc_resubmission_required:    'Verification update needed',
  payout_processed:             'Payout processed',
};

export function notifBody(type: string, data: Record<string, unknown>): string {
  const charger = (data.charger_title as string | undefined) ?? '';
  const driver  = (data.driver_name  as string | undefined) ?? '';
  switch (type) {
    case 'booking_received':
      return charger
        ? `New request for ${charger}${driver ? ` from ${driver}` : ''}`
        : 'You have a new booking request';
    case 'booking_accepted':
      return charger ? `Your booking at ${charger} has been confirmed` : 'Your booking has been confirmed';
    case 'booking_rejected':
      return charger ? `Your booking at ${charger} was not accepted` : 'Your booking was not accepted';
    case 'booking_auto_rejected':
      return 'The booking request was not accepted in time';
    case 'booking_cancelled':
      return charger ? `Booking at ${charger} was cancelled` : 'A booking was cancelled';
    case 'booking_no_show':
      return 'A no-show was recorded for this booking';
    case 'session_initiation_requested':
      return charger ? `Session start requested at ${charger}` : 'Session start has been requested';
    case 'session_started':
      return charger ? `Your charging session at ${charger} has started` : 'Your charging session has started';
    case 'session_end_requested':
      return 'Session end has been requested';
    case 'session_completed':
      return charger ? `Your session at ${charger} is complete` : 'Your session is complete';
    case 'kyc_approved':
      return 'Your identity verification has been approved';
    case 'kyc_rejected':
      return 'Your verification was rejected. Please resubmit in Profile';
    case 'kyc_resubmission_required':
      return 'Please update your verification documents in Profile';
    case 'payout_processed':
      return 'Your payout was marked processed';
    default:
      return '';
  }
}
