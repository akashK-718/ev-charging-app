import Link from 'next/link';
import { AlertCircle, BookOpen, ChevronRight, TrendingDown } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

// Serialisable nudge data passed from the server component
export type RuleNudge =
  | { type: 'photos';           chargerId: string; chargerTitle: string }
  | { type: 'lower-price';      chargerId: string; chargerTitle: string }
  | { type: 'hosting-discovery' }
  | { type: 'tip'; id: string; title?: string; body: string; linkLabel?: string; linkHref?: string }
  | null;

interface Props {
  ruleNudge: RuleNudge;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DynamicNudge({ ruleNudge }: Props) {
  if (!ruleNudge) return null;

  return (
    <section aria-label="Suggestion">
      {ruleNudge.type === 'photos' && (
        <Link
          href={`/lender/chargers/${ruleNudge.chargerId}/edit`}
          className="rise-in flex items-center gap-3 bg-white border border-border rounded-3xl px-4 py-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="size-9 rounded-xl bg-copper-soft grid place-items-center shrink-0">
            <AlertCircle className="size-4 text-copper" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink">Add more photos</p>
            <p className="text-xs text-muted">
              Listings with 3+ photos receive more bookings · {ruleNudge.chargerTitle}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
        </Link>
      )}

      {ruleNudge.type === 'lower-price' && (
        <Link
          href={`/lender/chargers/${ruleNudge.chargerId}/edit`}
          className="rise-in flex items-center gap-3 bg-white border border-border rounded-3xl px-4 py-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
            <TrendingDown className="size-4 text-green" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink">No bookings in 30 days</p>
            <p className="text-xs text-muted">
              Adjusting your price may help · {ruleNudge.chargerTitle}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
        </Link>
      )}

      {ruleNudge.type === 'hosting-discovery' && (
        <div className="rise-in bg-white border border-border rounded-3xl px-4 py-5 shadow-sm">
          <p className="text-base font-bold text-ink mb-1">
            Earn with your home charger.
          </p>
          <p className="text-sm text-muted mb-4 leading-relaxed">
            Share your charger when you&apos;re not using it. Set your own hours and earn extra income.
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-surface-page border border-border text-ink text-sm font-semibold active:scale-95 transition-transform"
          >
            Learn more
          </Link>
        </div>
      )}

      {ruleNudge.type === 'tip' && (
        <div className="rise-in bg-white border border-border rounded-3xl px-4 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-surface-page grid place-items-center shrink-0">
              <BookOpen className="size-4 text-muted" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              {ruleNudge.title && (
                <p className="text-xs font-semibold text-muted mb-1 uppercase tracking-wide">{ruleNudge.title}</p>
              )}
              <p className="text-sm text-ink-soft leading-relaxed">{ruleNudge.body}</p>
              {ruleNudge.linkHref && ruleNudge.linkLabel && (
                <Link
                  href={ruleNudge.linkHref}
                  className="inline-block mt-2 text-xs font-semibold text-green underline underline-offset-2"
                >
                  {ruleNudge.linkLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
