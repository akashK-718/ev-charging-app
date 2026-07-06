'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const MapView = dynamic(
  () => import('@/components/maps/MapView').then(m => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />,
  },
);

type ChargerStatus = 'draft' | 'active' | 'paused' | 'suspended';

type ChargerInfo = {
  id: string;
  title: string;
  address: string;
  status: ChargerStatus;
  latitude: number;
  longitude: number;
};

function ChargerStatusBadge({ status }: { status: ChargerStatus }) {
  return (
    <span className={cn(
      'px-2.5 py-1 rounded-full text-xs font-semibold shrink-0',
      status === 'active'    ? 'bg-volt-soft text-volt-deep' :
      status === 'draft'     ? 'bg-yellow-50 text-yellow-700' :
      status === 'paused'    ? 'bg-gray-100 text-muted' :
                               'bg-red-50 text-red-700',
    )}>
      {status === 'active' ? 'Live' : status === 'draft' ? 'Draft' : status === 'paused' ? 'Paused' : 'Suspended'}
    </span>
  );
}

export default function LenderChargerMapPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const readonly = searchParams.get('readonly') === 'true';

  const [charger, setCharger] = useState<ChargerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = readonly
      ? `/api/chargers/${params.id}`
      : `/api/lender/chargers/${params.id}`;

    fetch(apiUrl)
      .then(async res => {
        if (!res.ok) {
          if (readonly) { router.back(); } else { router.replace('/lender/chargers'); }
          return;
        }
        const body = await res.json() as { charger?: ChargerInfo; data?: ChargerInfo };
        const info = body.charger ?? body.data ?? null;
        if (!info) { if (readonly) { router.back(); } else { router.replace('/lender/chargers'); } return; }
        setCharger({ ...info, latitude: Number(info.latitude), longitude: Number(info.longitude) });
      })
      .catch(() => { if (readonly) { router.back(); } else { router.replace('/lender/chargers'); } })
      .finally(() => setLoading(false));
  }, [params.id, router, readonly]);

  if (loading) {
    return (
      <div className="h-[calc(100dvh-3.5rem)] bg-gray-100 animate-pulse flex items-center justify-center">
        <p className="text-sm text-muted">Loading map…</p>
      </div>
    );
  }

  if (!charger) return null;

  const coords = { lat: Number(charger.latitude), lng: Number(charger.longitude) };

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* Map — fills full screen */}
      <MapView
        center={coords}
        zoom={16}
        draggablePin={{ coords, onDragEnd: () => {} }}
      />

      {/* Top overlay — back button + title */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 pt-4 pb-6 bg-gradient-to-b from-black/40 to-transparent pointer-events-none">
        {readonly ? (
          <button
            onClick={() => router.back()}
            className="pointer-events-auto w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 text-ink" />
          </button>
        ) : (
          <Link
            href={`/lender/chargers/${params.id}`}
            className="pointer-events-auto w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow"
            aria-label="Back to charger detail"
          >
            <ChevronLeft className="w-5 h-5 text-ink" />
          </Link>
        )}
        <h1 className="text-white text-sm font-bold drop-shadow truncate">{charger.title}</h1>
      </div>

      {/* Bottom overlay — info card */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-6">
        <div className="bg-white rounded-xl shadow-xl px-4 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink truncate">{charger.title}</p>
            <p className="text-xs text-muted mt-0.5 leading-snug line-clamp-2">{charger.address}</p>
          </div>
          {!readonly && <ChargerStatusBadge status={charger.status} />}
        </div>
      </div>
    </div>
  );
}
