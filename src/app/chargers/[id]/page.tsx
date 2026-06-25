import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
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
  const { data, error } = await supabase
    .from('chargers')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();

  const charger = data as ChargerRow;

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
      {charger.photos && charger.photos.length > 0 ? (
        <div className="flex overflow-x-auto gap-2 px-4 sm:px-6 pb-2 scrollbar-none">
          {charger.photos.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${charger.title} photo ${i + 1}`}
              className={
                i === 0
                  ? 'rounded-2xl object-cover w-full max-w-full aspect-[16/9] shrink-0'
                  : 'rounded-2xl object-cover w-40 h-28 shrink-0'
              }
            />
          ))}
        </div>
      ) : (
        <div className="mx-4 sm:mx-6 aspect-[16/9] rounded-2xl bg-volt-soft flex items-center justify-center">
          <Zap className="w-16 h-16 text-volt opacity-30" />
        </div>
      )}

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

        {/* Address */}
        <div className="flex gap-2">
          <MapPin className="w-4 h-4 text-muted mt-0.5 shrink-0" />
          <p className="text-sm text-muted">{charger.address}</p>
        </div>

        {/* Access instructions */}
        {charger.instructions && (
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Access instructions
            </p>
            <p className="text-sm text-ink">{charger.instructions}</p>
          </div>
        )}

        {/* CTA */}
        <div>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            disabled
          >
            Book this charger
          </Button>
          <p className="text-xs text-muted text-center mt-2">
            Booking available in Module 3 — coming soon.
          </p>
        </div>
      </div>
    </main>
  );
}
