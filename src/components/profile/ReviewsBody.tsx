'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, Zap, User } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
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

export function ReviewsBody({ written }: { written: WrittenCard[] }) {
  const router = useRouter();

  return (
    <div>
      <PageHeader title="Reviews" onClick={() => router.back()} />

      <div className="px-4 pb-4">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-muted mb-3">
          Written by you
        </p>
        {written.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="size-12 rounded-2xl bg-green-soft text-green-deep grid place-items-center">
              <Star className="w-5 h-5" />
            </div>
            <p className="text-sm text-muted text-center">
              Reviews you write after charging sessions appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {written.map(card => (
              <WrittenReviewCard key={card.bookingId} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
