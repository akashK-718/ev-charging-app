'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toJpegUrl } from '@/lib/cloudinary-url';

interface Charger {
  id: string;
  title: string;
  photos: string[] | null;
  charger_type: string | null;
  price_per_kwh: number | null;
}

export function NearbyChargerCard({
  charger,
  className,
}: {
  charger: Charger;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const photo = charger.photos?.[0];
  const showImg = !!photo && !imgFailed;

  return (
    <Link
      href={`/chargers/${charger.id}`}
      className={cn(
        'bg-white border border-border rounded-2xl overflow-hidden shadow-sm active:scale-95 transition-transform',
        className ?? 'shrink-0 w-36',
      )}
    >
      <div className="h-16 relative bg-gradient-to-br from-green-700 to-green-500 overflow-hidden">
        {showImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={toJpegUrl(photo)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        )}
        {!showImg && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="size-5 text-white/50" aria-hidden />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-ink truncate">{charger.title}</p>
        <p className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
          <Zap className="size-2.5" aria-hidden />
          {charger.charger_type ?? 'EV'} · {charger.price_per_kwh != null ? `₹${charger.price_per_kwh}/kWh` : '—'}
        </p>
      </div>
    </Link>
  );
}
