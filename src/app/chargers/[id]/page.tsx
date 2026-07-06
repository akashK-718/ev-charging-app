import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Zap, Info } from 'lucide-react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
import { ImageCarousel } from '@/components/chargers/ImageCarousel';
import type { Database } from '@/lib/supabase/types';

type ChargerRow = Database['public']['Tables']['chargers']['Row'];

const CHARGER_TYPE_LABEL: Record<string, string> = {
  'AC_3.3kW': '3.3 kW · AC',
  'AC_7kW': '7 kW · AC',
  'AC_22kW': '22 kW · AC',
  'DC_fast': 'DC Fast',
};

export default async function ChargerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from('chargers')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();

  const charger = data as ChargerRow;

  // Check if the current user has a confirmed booking for this charger
  let hasConfirmedBooking = false;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: booking } = await adminSupabase
      .from('bookings')
      .select('id')
      .eq('charger_id', params.id)
      .eq('driver_id', user.id)
      .in('status', ['confirmed', 'awaiting_driver_confirmation', 'in_progress', 'completed'])
      .maybeSingle();
    hasConfirmedBooking = !!booking;
  }

  const powerLabel = CHARGER_TYPE_LABEL[charger.charger_type] ?? charger.charger_type;

  return (
    <main className="min-h-screen max-w-2xl mx-auto">
      {/* Back */}
      <div className="px-4 sm:px-6 pt-6 pb-2">
        <Link
          href="/chargers"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All chargers
        </Link>
      </div>

      {/* Photos */}
      <div className="mx-4 sm:mx-6">
        <ImageCarousel
          photos={charger.photos ?? []}
          alt={charger.title}
          autoRotate
          useIntersectionObserver={false}
          className="rounded-2xl"
        />
      </div>

      {/* Details */}
      <div className="px-4 sm:px-6 py-6 space-y-6">
        {/* Title + price */}
        <div>
          <h1 className="font-display font-extrabold text-2xl text-ink">{charger.title}</h1>
          <p className="mt-1 text-2xl font-bold text-volt-deep">
            ₹{charger.price_per_kwh}
            <span className="text-base font-semibold text-muted">/kWh</span>
          </p>
        </div>

        {/* Specs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-1">Charger type</p>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-volt-deep" />
              <span className="text-sm font-semibold text-ink">{powerLabel}</span>
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-1">Connectors</p>
            <div className="flex flex-wrap gap-1">
              {charger.connector_types.map(ct => (
                <span
                  key={ct}
                  className="px-1.5 py-0.5 rounded-md bg-volt-soft text-ink text-[10px] font-semibold"
                >
                  {ct}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Address — gated on confirmed booking */}
        {hasConfirmedBooking ? (
          <div className="flex gap-2">
            <MapPin className="w-4 h-4 text-muted mt-0.5 shrink-0" />
            <p className="text-sm text-muted">{charger.address}</p>
          </div>
        ) : (
          <div className="flex gap-2 items-start px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-200">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700">
              Approximate location — exact address shared after booking confirmed.
            </p>
          </div>
        )}

        {/* Access instructions — shown only after confirmed */}
        {hasConfirmedBooking && charger.instructions && (
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Access instructions
            </p>
            <p className="text-sm text-ink">{charger.instructions}</p>
          </div>
        )}

        {/* CTA */}
        <div>
          <Link href={`/bookings/new?charger=${charger.id}`}>
            <Button variant="secondary" size="lg" className="w-full">
              Book this charger
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
