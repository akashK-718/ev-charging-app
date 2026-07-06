'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { StarRating } from './StarRating';
import { Button } from '@/components/ui/Button';

interface ExistingReview {
  review_type: string;
  rating: number;
  review_text: string | null;
}

interface ReviewApiResponse {
  reviews: ExistingReview[];
  can_edit: boolean;
  edit_expires_at: string | null;
  repeat_context: {
    prior_driver_review_count: number;
    last_driver_review_at: string | null;
  };
}

type SectionState =
  | { kind: 'loading' }
  | { kind: 'rating'; skipProminent: boolean }
  | { kind: 'suppressed' }
  | { kind: 'submitted'; review: ExistingReview; canEdit: boolean }
  | { kind: 'editing'; review: ExistingReview }
  | { kind: 'skipped' }
  | { kind: 'success'; driverRating: number };

function fmtDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

interface LenderRatingSectionProps {
  bookingId: string;
  driverName: string;
  startedAt: string | null;
  endedAt: string | null;
  kwhDelivered: number | null;
}

export function LenderRatingSection({
  bookingId,
  driverName,
  startedAt,
  endedAt,
  kwhDelivered,
}: LenderRatingSectionProps) {
  const [state, setState] = useState<SectionState>({ kind: 'loading' });
  const [driverRating, setDriverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/review`);
        if (!res.ok) { setState({ kind: 'suppressed' }); return; }
        const data = await res.json() as ReviewApiResponse;
        const { prior_driver_review_count, last_driver_review_at } = data.repeat_context;

        if (prior_driver_review_count >= 5) {
          setState({ kind: 'suppressed' });
          return;
        }

        const driverReview = data.reviews.find(r => r.review_type === 'driver');
        if (driverReview) {
          setState({ kind: 'submitted', review: driverReview, canEdit: data.can_edit });
          return;
        }

        const skipProminent = prior_driver_review_count > 0
          && last_driver_review_at !== null
          && (Date.now() - new Date(last_driver_review_at).getTime()) / 86400000 < 30;

        setState({ kind: 'rating', skipProminent });
      } catch {
        setState({ kind: 'suppressed' });
      }
    }
    void load();
  }, [bookingId]);

  async function handleSubmit() {
    if (driverRating === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_rating: driverRating }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setSubmitError(body.error ?? 'Failed to submit review');
        return;
      }
      setState({ kind: 'success', driverRating });
    } catch {
      setSubmitError('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === 'loading') {
    return <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />;
  }

  if (state.kind === 'suppressed' || state.kind === 'skipped') {
    return (
      <div className="px-4 py-3 bg-gray-50 rounded-xl">
        <p className="text-sm font-semibold text-ink">Session completed</p>
        {startedAt && endedAt && (
          <p className="text-xs text-muted mt-0.5">{driverName} charged for {fmtDuration(startedAt, endedAt)}</p>
        )}
        {kwhDelivered !== null && (
          <p className="text-xs text-muted mt-0.5">{kwhDelivered} kWh delivered</p>
        )}
        <p className="text-xs text-muted mt-0.5">Earnings queued — see Payouts.</p>
      </div>
    );
  }

  if (state.kind === 'submitted') {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-volt-deep shrink-0" />
          <p className="text-sm font-semibold text-ink">Your review</p>
          {state.canEdit && (
            <button
              type="button"
              onClick={() => {
                setDriverRating(state.review.rating);
                setState({ kind: 'editing', review: state.review });
              }}
              className="ml-auto text-xs font-semibold text-volt-deep hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Driver</p>
          <StarRating value={state.review.rating} size="sm" />
        </div>
      </div>
    );
  }

  if (state.kind === 'success') {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-volt-deep shrink-0" />
          <p className="text-sm font-semibold text-ink">Thanks — your review helps the community</p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Driver</p>
          <StarRating value={state.driverRating} size="sm" />
        </div>
      </div>
    );
  }

  // 'rating' | 'editing'
  const skipProminent = state.kind === 'rating' ? state.skipProminent : false;
  const isEditing = state.kind === 'editing';

  const submitButton = (
    <Button
      variant="secondary"
      size="lg"
      disabled={driverRating === 0 || submitting}
      className={skipProminent ? '' : 'flex-1'}
      onClick={() => { void handleSubmit(); }}
    >
      {submitting ? 'Submitting…' : isEditing ? 'Update review' : 'Submit'}
    </Button>
  );

  const skipButton = (
    <Button
      variant={skipProminent ? 'secondary' : 'ghost'}
      size="lg"
      className={skipProminent ? 'flex-1' : ''}
      onClick={() => {
        if (isEditing) {
          setState({ kind: 'submitted', review: state.review, canEdit: false });
        } else {
          setState({ kind: 'skipped' });
        }
      }}
    >
      {isEditing ? 'Cancel' : 'Skip'}
    </Button>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-volt-deep shrink-0" />
        <p className="text-sm font-semibold text-ink">Session complete</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted">
          {driverName} charged for{startedAt && endedAt ? ` ${fmtDuration(startedAt, endedAt)}` : ''}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink mb-2">Rate this driver</p>
        <StarRating value={driverRating} onChange={setDriverRating} />
      </div>

      {submitError && (
        <p className="text-xs text-red-600 font-semibold">{submitError}</p>
      )}

      <div className="flex gap-2">
        {skipProminent ? (
          <>
            {skipButton}
            {submitButton}
          </>
        ) : (
          <>
            {skipButton}
            {submitButton}
          </>
        )}
      </div>
    </div>
  );
}
