import Link from 'next/link';
import { MapPin, Star, Zap } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import type { ChargerWithDistance } from '@/types';

interface ChargerCardProps {
  charger: ChargerWithDistance;
}

export function ChargerCard({ charger }: ChargerCardProps) {
  const distanceKm = (charger.distanceMeters / 1000).toFixed(1);

  return (
    <Link
      href={`/chargers/${charger.id}`}
      className="block p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-md transition-shadow"
    >
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-xl bg-volt-soft grid place-items-center flex-shrink-0 relative">
          <Zap className="w-7 h-7 text-volt-deep" />
          <span
            className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
              charger.isAvailable ? 'bg-volt' : 'bg-gray-300'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline gap-2">
            <h3 className="font-display font-bold text-sm truncate">
              {charger.title}
            </h3>
            <span className="font-display font-extrabold text-sm whitespace-nowrap">
              {formatINR(charger.pricePerKwh)}
              <small className="text-muted font-semibold">/kWh</small>
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-muted font-semibold">
            {charger.avgRating !== null && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                {charger.avgRating.toFixed(1)}
              </span>
            )}
            <span className="text-volt-deep bg-volt-soft px-2 py-0.5 rounded font-bold">
              {charger.connectorType}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {distanceKm} km
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
