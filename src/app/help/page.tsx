import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: { section: string; items: FaqItem[] }[] = [
  {
    section: 'Booking and charging',
    items: [
      {
        q: 'How do I find a charger near me?',
        a: 'Go to the Explore tab and browse chargers on the map. You can filter by connector type and availability. Tap any charger to see its details and book a slot.',
      },
      {
        q: 'How do I cancel a booking?',
        a: 'Open the Activity tab, find the booking you want to cancel, and tap "Cancel booking." Cancellations made more than 1 hour before the slot start time are free. Later cancellations may incur a fee as described in our cancellation policy.',
      },
      {
        q: 'What if the charger is unavailable when I arrive?',
        a: 'If the charger is offline or inaccessible, contact the host via your booking details. If the issue is unresolved, raise a support request below and we will review it promptly.',
      },
      {
        q: 'How long can I charge for?',
        a: 'You pay per kWh consumed, not per hour. Your booking window is fixed to the slot you reserved. If you need more time, check the charger\'s availability and book an additional slot.',
      },
      {
        q: 'Which connector types are supported?',
        a: 'Kirin supports Type 2, Bharat AC, CCS2, CHAdeMO, and Type 1. Each charger listing shows its connector type before you book.',
      },
    ],
  },
  {
    section: 'Payments',
    items: [
      {
        q: 'When am I charged?',
        a: 'Payment is collected when your session ends, based on the actual kWh delivered. If the session fails to start, no charge is applied.',
      },
      {
        q: 'What payment methods are accepted?',
        a: 'We accept UPI, credit and debit cards, and net banking through Razorpay. All transactions are secured and encrypted.',
      },
      {
        q: 'How do I get a receipt?',
        a: 'A receipt is available in your Activity tab after each completed session. You can also request one by contacting support.',
      },
    ],
  },
  {
    section: 'Hosting and payouts',
    items: [
      {
        q: 'When do I get paid as a host?',
        a: 'Earnings from completed sessions are settled to your registered bank account within 3 to 5 business days after the session ends. You can track your payout status in the Activity tab.',
      },
      {
        q: 'What does KYC verification involve?',
        a: 'To receive payouts, hosts must complete identity verification. You will need to upload a government-issued ID. Verification typically takes 1 to 2 business days.',
      },
      {
        q: 'Can I pause my charger listing?',
        a: 'Yes. Go to My Chargers in the Profile tab, open the charger, and set its status to Paused. Paused chargers are hidden from the map and cannot receive new bookings.',
      },
      {
        q: 'How is my rate per kWh set?',
        a: 'You set your own rate when you create or edit a charger listing. The rate must be between \u20B94 and \u20B930 per kWh.',
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto pb-8">

        <PageHeader
          title="Help and support"
          subtitle="Answers to common questions. Can't find what you need? Contact us below."
          href="/profile"
        />

        {/* FAQ sections */}
        <div className="px-4 flex flex-col gap-8">
          {FAQ.map(({ section, items }) => (
            <section key={section}>
              <p className="text-xs font-mono font-semibold tracking-widest uppercase text-muted mb-3">
                {section}
              </p>
              <div className="rounded-token border border-border bg-surface-card divide-y divide-border">
                {items.map(({ q, a }) => (
                  <details key={q} className="group px-4 py-3.5">
                    <summary className="flex items-start justify-between gap-3 cursor-pointer list-none text-sm font-semibold text-ink select-none">
                      <span>{q}</span>
                      <ChevronDown className="w-4 h-4 text-muted shrink-0 mt-0.5 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-2.5 text-sm text-muted leading-relaxed">{a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Contact us */}
        <section className="mt-10 px-4">
          <p className="text-xs font-mono font-semibold tracking-widest uppercase text-muted mb-3">
            Contact us
          </p>
          <div className="rounded-token border border-border bg-surface-card p-5">
            <p className="text-sm font-semibold text-ink mb-1">Still need help?</p>
            <p className="text-sm text-muted mb-4">
              We typically respond within one business day.
            </p>
            <a
              href="mailto:support@brandname.in"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-token bg-green text-white text-sm font-semibold hover:bg-green-deep transition-colors"
            >
              Email support
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}
