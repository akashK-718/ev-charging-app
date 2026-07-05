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
    prior_charger_review_count: number;
    last_charger_review_at: string | null;
  };
}

type SectionState =
  | { kind: 'loading' }
  | { kind: 'rating'; skipProminent: boolean }
  | { kind: 'suppressed' }
  | { kind: 'submitted'; reviews: ExistingReview[]; canEdit: boolean }
  | { kind: 'editing'; reviews: ExistingReview[] }
  | { kind: 'skipped' }
  | { kind: 'success'; chargerRating: number; lenderRating: number; reviewText: string };

function fmtDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function CompletedSummary({
  endedAt,
  startedAt,
  paymentPaise,
}: {
  endedAt: string | null;
  startedAt: string | null;
  paymentPaise: number | null;
}) {
  return (
    <div className="px-4 py-3 bg-gray-50 rounded-2xl space-y-1">
      <p className="text-sm font-semibold text-ink">
        Session completed
        {endedAt
          ? ` at ${new Date(endedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
          : ''}
      </p>
      {startedAt && endedAt && (
        <p className="text-xs text-muted">Duration: {fmtDuration(startedAt, endedAt)}</p>
      )}
      {paymentPaise !== null && (
        <p className="text-xs text-muted">Amount: ₹{(paymentPaise / 100).toFixed(0)}</p>
      )}
    </div>
  );
}

interface DriverRatingSectionProps {
  bookingId: string;
  chargerTitle: string;
  startedAt: string | null;
  endedAt: string | null;
  paymentPaise: number | null;
}

export function DriverRatingSection({
  bookingId,
  chargerTitle,
  startedAt,
  endedAt,
  paymentPaise,
}: DriverRatingSectionProps) {
  const [state, setState] = useState<SectionState>({ kind: 'loading' });
  const [chargerRating, setChargerRating] = useState(0);
  const [lenderRating, setLenderRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/review`);
        if (!res.ok) { setState({ kind: 'suppressed' }); return; }
        const data = await res.json() as ReviewApiResponse;
        const { prior_charger_review_count, last_charger_review_at } = data.repeat_context;

        if (prior_charger_review_count >= 5) {
          setState({ kind: 'suppressed' });
          return;
        }

        if (data.reviews.length > 0) {
          setState({ kind: 'submitted', reviews: data.reviews, canEdit: data.can_edit });
          return;
        }

        const skipProminent = prior_charger_review_count > 0
          && last_charger_review_at !== null
          && (Date.now() - new Date(last_charger_review_at).getTime()) / 86400000 < 30;

        setState({ kind: 'rating', skipProminent });
      } catch {
        setState({ kind: 'suppressed' });
      }
    }
    void load();
  }, [bookingId]);

  async function handleSubmit() {
    if (chargerRating === 0 || lenderRating === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charger_rating: chargerRating,
          lender_rating: lenderRating,
          review_text: reviewText.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setSubmitError(body.error ?? 'Failed to submit review');
        return;
      }
      setState({ kind: 'success', chargerRating, lenderRating, reviewText: reviewText.trim() });
    } catch {
      setSubmitError('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  function openEditor(existingReviews: ExistingReview[]) {
    const chargerR = existingReviews.find(r => r.review_type === 'charger');
    const lenderR = existingReviews.find(r => r.review_type === 'lender');
    setChargerRating(chargerR?.rating ?? 0);
    setLenderRating(lenderR?.rating ?? 0);
    setReviewText(chargerR?.review_text ?? '');
    setState({ kind: 'editing', reviews: existingReviews });
  }

  if (state.kind === 'loading') {
    return <div className="h-24 bg-gray-50 rounded-2xl animate-pulse" />;
  }

  if (state.kind === 'suppressed' || state.kind === 'skipped') {
    return (
      <CompletedSummary endedAt={endedAt} startedAt={startedAt} paymentPaise={paymentPaise} />
    );
  }

  if (state.kind === 'submitted') {
    const chargerR = state.reviews.find(r => r.review_type === 'charger');
    const lenderR = state.reviews.find(r => r.review_type === 'lender');
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-volt-deep shrink-0" />
          <p className="text-sm font-semibold text-ink">Your review</p>
          {state.canEdit && (
            <button
              type="button"
              onClick={() => openEditor(state.reviews)}
              className="ml-auto text-xs font-semibold text-volt-deep hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        {chargerR && (
          <div>
            <p className="text-xs text-muted mb-1">Charger</p>
            <StarRating value={chargerR.rating} size="sm" />
            {chargerR.review_text && (
              <p className="text-xs text-ink mt-1 italic">&ldquo;{chargerR.review_text}&rdquo;</p>
            )}
          </div>
        )}
        {lenderR && (
          <div>
            <p className="text-xs text-muted mb-1">Host</p>
            <StarRating value={lenderR.rating} size="sm" />
          </div>
        )}
      </div>
    );
  }

  if (state.kind === 'success') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-volt-deep shrink-0" />
          <p className="text-sm font-semibold text-ink">Thanks — your review helps the community</p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Charger</p>
          <StarRating value={state.chargerRating} size="sm" />
          {state.reviewText && (
            <p className="text-xs text-ink mt-1 italic">&ldquo;{state.reviewText}&rdquo;</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Host</p>
          <StarRating value={state.lenderRating} size="sm" />
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
      disabled={chargerRating === 0 || lenderRating === 0 || submitting}
      className={skipProminent ? '' : 'flex-1'}
      onClick={() => { void handleSubmit(); }}
    >
      {submitting ? 'Submitting…' : isEditing ? 'Update review' : 'Submit rating'}
    </Button>
  );

  const skipButton = (
    <Button
      variant={skipProminent ? 'secondary' : 'ghost'}
      size="lg"
      className={skipProminent ? 'flex-1' : ''}
      onClick={() => {
        if (isEditing) {
          setState({ kind: 'submitted', reviews: state.reviews, canEdit: false });
        } else {
          setState({ kind: 'skipped' });
        }
      }}
    >
      {isEditing ? 'Cancel' : 'Skip'}
    </Button>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-volt-deep shrink-0" />
        <p className="text-sm font-semibold text-ink">Session complete</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted">{chargerTitle}</p>
        {startedAt && endedAt && (
          <p className="text-xs text-muted mt-0.5">{fmtDuration(startedAt, endedAt)}</p>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink mb-2">Rate your charging experience</p>
          <StarRating value={chargerRating} onChange={setChargerRating} />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink mb-2">Rate your host</p>
          <StarRating value={lenderRating} onChange={setLenderRating} />
        </div>
        <div>
          <label htmlFor={`review_text_${bookingId}`} className="text-sm font-semibold text-ink">
            Add a note <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={`review_text_${bookingId}`}
            value={reviewText}
            onChange={e => setReviewText(e.target.value.slice(0, 200))}
            rows={3}
            maxLength={200}
            placeholder="How was your experience?"
            className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt resize-none"
          />
          <p className="text-xs text-muted mt-1 text-right">{reviewText.length}/200</p>
        </div>
      </div>

      {submitError && (
        <p className="text-xs text-red-600 font-semibold">{submitError}</p>
      )}

      {skipProminent ? (
        <div className="flex gap-2">
          {skipButton}
          {submitButton}
        </div>
      ) : (
        <div className="flex gap-2">
          {skipButton}
          {submitButton}
        </div>
      )}
    </div>
  );
}
