'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star, Zap, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WrittenCard = {
  bookingId: string;
  chargerTitle: string;
  scheduledStart: string;
  chargerRating: number | null;
  lenderRating: number | null;
  driverRating: number | null;
  reviewText: string | null;
  createdAt: string;
};

export type ReceivedCard = {
  bookingId: string;
  chargerTitle: string;
  scheduledStart: string;
  reviewerName: string | null;
  rating: number;
  createdAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StarRow({ rating, label }: { rating: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted w-14 shrink-0">{label}</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn('w-3 h-3', i < rating ? 'fill-[#10d96a] text-[#10d96a]' : 'fill-none text-border')}
            aria-hidden
          />
        ))}
      </div>
      <span className="text-[11px] font-semibold text-ink">{rating}.0</span>
    </div>
  );
}

function WrittenReviewCard({ card }: { card: WrittenCard }) {
  const isDriverCard = card.chargerRating !== null || card.lenderRating !== null;

  return (
    <Link href={`/bookings/${card.bookingId}`} className="block">
      <div className="bg-surface-card border border-border rounded-2xl px-4 py-3.5 hover:bg-surface-page transition-colors">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-green-soft text-green-deep grid place-items-center shrink-0 mt-0.5">
            {isDriverCard ? <Zap className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{card.chargerTitle}</p>
            <p className="text-[11px] text-muted mb-2">{fmtDate(card.scheduledStart)}</p>
            <div className="space-y-1">
              {card.chargerRating !== null && (
                <StarRow rating={card.chargerRating} label="Charger" />
              )}
              {card.lenderRating !== null && (
                <StarRow rating={card.lenderRating} label="Host" />
              )}
              {card.driverRating !== null && (
                <StarRow rating={card.driverRating} label="Driver" />
              )}
            </div>
            {card.reviewText && (
              <p className="text-xs text-muted mt-2 leading-relaxed line-clamp-3">{card.reviewText}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ReceivedReviewCard({ card }: { card: ReceivedCard }) {
  return (
    <Link href={`/bookings/${card.bookingId}`} className="block">
      <div className="bg-surface-card border border-border rounded-2xl px-4 py-3.5 hover:bg-surface-page transition-colors">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-green-soft text-green-deep grid place-items-center shrink-0 mt-0.5">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink truncate">
              {card.reviewerName ?? 'A driver'}
            </p>
            <p className="text-[11px] text-muted mb-2">{card.chargerTitle} · {fmtDate(card.scheduledStart)}</p>
            <StarRow rating={card.rating} label="Host" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[10px] font-semibold tracking-wider uppercase text-muted px-4 mb-3">{title}</p>
      <div className="space-y-3 px-4">
        {children}
      </div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8">
      <div className="size-12 rounded-2xl bg-green-soft text-green-deep grid place-items-center">
        <Star className="w-5 h-5" />
      </div>
      <p className="text-sm text-muted text-center">{message}</p>
    </div>
  );
}

export function ReviewsBody({
  written,
  received,
  isLender,
}: {
  written: WrittenCard[];
  received: ReceivedCard[];
  isLender: boolean;
}) {
  const router = useRouter();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-6">
        <button
          onClick={() => router.back()}
          className="size-9 rounded-xl bg-surface-page grid place-items-center hover:bg-green-soft transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-ink" />
        </button>
        <h1 className="text-xl font-bold text-ink">My Reviews</h1>
      </div>

      <div className="space-y-8 pb-4">
        {/* Written */}
        <Section title="Written by you">
          {written.length === 0 ? (
            <EmptyState message="Reviews you write after charging sessions appear here." />
          ) : (
            written.map(card => <WrittenReviewCard key={card.bookingId} card={card} />)
          )}
        </Section>

        {/* Received — lenders only */}
        {isLender && (
          <Section title="Received as host">
            {received.length === 0 ? (
              <EmptyState message="Reviews drivers leave about your hosting appear here." />
            ) : (
              received.map(card => <ReceivedReviewCard key={card.bookingId} card={card} />)
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
