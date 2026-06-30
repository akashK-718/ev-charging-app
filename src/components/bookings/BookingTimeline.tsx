import { Check } from 'lucide-react';

interface TimelineBooking {
  created_at: string;
  confirmed_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  status: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function BookingTimeline({ booking }: { booking: TimelineBooking }) {
  const events: { label: string; time: string; detail?: string | null }[] = [
    { label: 'Booked', time: booking.created_at },
  ];

  if (booking.confirmed_at) {
    events.push({ label: 'Confirmed', time: booking.confirmed_at });
  }
  if (booking.rejected_at) {
    events.push({
      label: booking.status === 'auto_rejected' ? 'Auto-declined' : 'Declined',
      time: booking.rejected_at,
      detail: booking.rejection_reason,
    });
  }
  if (booking.started_at) {
    events.push({ label: 'Session started', time: booking.started_at });
  }
  if (booking.ended_at) {
    events.push({ label: 'Session completed', time: booking.ended_at });
  }

  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="w-5 h-5 rounded-full bg-volt-soft flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-volt-deep" />
            </span>
            {i < events.length - 1 && <span className="w-px flex-1 bg-gray-200 my-0.5" />}
          </div>
          <div className="pb-3">
            <p className="text-sm font-semibold text-ink">{event.label}</p>
            <p className="text-xs text-muted">{formatTime(event.time)}</p>
            {event.detail && <p className="text-xs text-muted mt-0.5">{event.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
