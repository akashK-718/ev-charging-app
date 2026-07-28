import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Check, Shield, IndianRupee,
  Zap, MapPin, Calendar, Camera, Tag,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { StartHostingButton } from './StartHostingButton';

const HOW_IT_WORKS = [
  'Turn on hosting',
  'Add your charger',
  'Complete verification',
  'Your charger goes live',
  'Accept bookings and earn',
] as const;

const WHAT_YOU_NEED = [
  { Icon: Zap,          label: 'Charger details' },
  { Icon: Camera,       label: 'Charger photos' },
  { Icon: MapPin,       label: 'Address and location' },
  { Icon: Tag,          label: 'Pricing' },
  { Icon: Calendar,     label: 'Availability' },
] as const;

const BENEFITS = [
  'Earn from your unused charger',
  'Set your own price',
  'Choose your own availability',
  'Pause hosting anytime',
] as const;

export default async function HostingLearnPage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/auth');

  return (
    <>
      <main className="min-h-screen px-6 pt-10 pb-[calc(11rem+env(safe-area-inset-bottom))] space-y-8 lg:pb-10">

        {/* Back */}
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted tap-light -ml-1"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Home
        </Link>

        {/* Header */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-green-600 mb-1">
            Hosting
          </p>
          <h1 className="text-2xl font-bold text-ink">Share your charger. Earn money.</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            Share your home EV charger with nearby EV drivers and earn money when you&apos;re not using it.
          </p>
        </div>

        {/* How it works */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ink">How it works</h2>
          <div className="space-y-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step} className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-green-soft grid place-items-center text-green text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-ink pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What you'll need */}
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
            What you&apos;ll need
          </p>
          <div className="bg-white rounded-2xl border border-border divide-y divide-border">
            {WHAT_YOU_NEED.map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3.5">
                <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
                  <Icon className="size-4 text-green" aria-hidden />
                </div>
                <span className="text-sm font-medium text-ink">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Before your charger can go live */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Before your charger can go live</h2>
          <div className="bg-white rounded-2xl border border-border divide-y divide-border">
            <div className="flex items-start gap-3 px-4 py-4">
              <div className="size-9 rounded-xl bg-amber-50 grid place-items-center shrink-0">
                <Shield className="size-4 text-amber-600" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Identity verification</p>
                <p className="text-xs text-muted mt-0.5">We collect Aadhaar and PAN as required by Indian payment regulations</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-4">
              <div className="size-9 rounded-xl bg-amber-50 grid place-items-center shrink-0">
                <IndianRupee className="size-4 text-amber-600" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Bank account or UPI</p>
                <p className="text-xs text-muted mt-0.5">For receiving payouts</p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Benefits</p>
          <div className="space-y-2.5">
            {BENEFITS.map(b => (
              <div key={b} className="flex items-center gap-3">
                <div className="size-5 rounded-full bg-green-soft grid place-items-center shrink-0">
                  <Check className="size-3 text-green" aria-hidden />
                </div>
                <p className="text-sm text-ink">{b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Desktop CTA — inline, only visible lg+ */}
        <div className="hidden lg:block pt-2 pb-4">
          <StartHostingButton />
        </div>

      </main>

      {/* Mobile CTA — fixed above bottom nav */}
      <div
        className="fixed inset-x-0 z-20 bg-surface-page/95 backdrop-blur-sm border-t border-border px-6 py-4 lg:hidden"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      >
        <StartHostingButton />
      </div>
    </>
  );
}
