import Link from 'next/link';
import { Star, Zap } from 'lucide-react';
import type { Database } from '@/lib/supabase/types';
import { toJpegUrl } from '@/lib/cloudinary-url';

export type ChargerRow = Database['public']['Tables']['chargers']['Row'];

const CHARGER_TYPE_LABEL: Record<string, string> = {
  'AC_3.3kW': '3.3 kW · AC',
  'AC_7kW': '7 kW · AC',
  'AC_22kW': '22 kW · AC',
  'DC_fast': 'DC Fast',
};

export function ChargerCard({
  charger,
  distanceKm,
}: {
  charger: ChargerRow;
  distanceKm?: number;
}) {
  const cover = charger.photos?.[0];
  const powerLabel = CHARGER_TYPE_LABEL[charger.charger_type] ?? charger.charger_type;

  return (
    <Link href={`/explore/${charger.id}`} className="block group tap-target">
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        {/* Cover photo */}
        <div className="aspect-[16/9] bg-volt-soft relative overflow-hidden">
          {cover ? (
            <img
              src={toJpegUrl(cover)}
              alt={charger.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Zap className="w-10 h-10 text-volt opacity-40" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-ink text-sm leading-snug line-clamp-1 flex-1">
              {charger.title}
            </h3>
            {charger.avg_rating !== null && (
              <div className="flex items-center gap-1 shrink-0">
                <Star className="w-3.5 h-3.5 text-volt fill-volt" />
                <span className="text-xs font-semibold text-ink">
                  {Number(charger.avg_rating).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted mt-1 line-clamp-1">
            {distanceKm !== undefined && (
              <span className="font-semibold text-volt-deep mr-1">
                {distanceKm < 1
                  ? `${Math.round(distanceKm * 1000)} m ·`
                  : `${distanceKm.toFixed(1)} km ·`}
              </span>
            )}
            {charger.address}
          </p>

          {/* Connector chips */}
          <div className="flex flex-wrap gap-1 mt-2">
            {charger.connector_types.map(ct => (
              <span
                key={ct}
                className="px-1.5 py-0.5 rounded-md bg-volt-soft text-ink text-[10px] font-semibold"
              >
                {ct}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted">{powerLabel}</span>
            <span className="font-bold text-ink text-sm">₹{charger.price_per_kwh}/kWh</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
