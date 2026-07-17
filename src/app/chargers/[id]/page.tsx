import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, MapPin, Star } from 'lucide-react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { ImageCarousel } from '@/components/chargers/ImageCarousel';
import { DisplayTitle } from '@/components/ui/DisplayTitle';
import { EyebrowLabel } from '@/components/ui/EyebrowLabel';
import { SpecTile } from '@/components/ui/SpecTile';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { ActionBar } from '@/components/ui/ActionBar';
import { Button } from '@/components/ui/Button';
import type { Database } from '@/lib/supabase/types';

type ChargerRow = Database['public']['Tables']['chargers']['Row'];

const CHARGER_TYPE_LABEL: Record<string, string> = {
  'AC_3.3kW': '3.3 kW · AC',
  'AC_7kW':   '7 kW · AC',
  'AC_22kW':  '22 kW · AC',
  'DC_fast':  'DC Fast',
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

  const [lenderResult, authResult] = await Promise.all([
    adminSupabase
      .from('users')
      .select('id, name, avatar_url, avg_rating')
      .eq('id', charger.lender_id)
      .single(),
    supabase.auth.getUser(),
  ]);

  const lender = lenderResult.data;
  const currentUser = authResult.data.user;

  let hasConfirmedBooking = false;
  if (currentUser) {
    const { data: booking } = await adminSupabase
      .from('bookings')
      .select('id')
      .eq('charger_id', params.id)
      .eq('driver_id', currentUser.id)
      .in('status', ['confirmed', 'awaiting_driver_confirmation', 'in_progress', 'completed'])
      .maybeSingle();
    hasConfirmedBooking = !!booking;
  }

  const powerLabel      = CHARGER_TYPE_LABEL[charger.charger_type] ?? charger.charger_type;
  const connectorsLabel = charger.connector_types.join(' · ');
  const isAvailable     = charger.status === 'active';

  return (
    <div className="min-h-screen bg-surface-page">

      {/* Mobile hero — edge-to-edge */}
      <div className="md:hidden">
        <ImageCarousel
          photos={charger.photos ?? []}
          alt={charger.title}
          autoRotate
          useIntersectionObserver={false}
          className="w-full h-[220px]"
        />
      </div>

      {/* Desktop breadcrumb */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 pt-6 pb-2">
        <nav className="flex items-center gap-1 text-sm text-muted" aria-label="Breadcrumb">
          <Link href="/chargers" className="hover:text-ink transition-colors">
            Chargers
          </Link>
          <ChevronRight className="w-3.5 h-3.5 opacity-40" />
          <span className="text-ink font-medium truncate max-w-xs">{charger.title}</span>
        </nav>
      </div>

      {/* Two-column layout */}
      <div className="max-w-6xl mx-auto md:px-6 md:pb-12">
        <div className="flex gap-8 items-start">

          {/* Main column */}
          <div className="flex-1 min-w-0">

            {/* Desktop hero */}
            <div className="hidden md:block mb-6">
              <ImageCarousel
                photos={charger.photos ?? []}
                alt={charger.title}
                autoRotate
                useIntersectionObserver={false}
                className="w-full h-[400px] rounded-token-lg"
              />
            </div>

            {/* Title + meta line */}
            <div className="bg-surface-card md:bg-transparent px-4 md:px-0 pt-5 pb-5 md:pb-6 border-b border-border md:border-0">
              <DisplayTitle>{charger.title}</DisplayTitle>

              {/* Rating · Sessions · Availability — appears exactly once */}
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted flex-wrap">
                {charger.avg_rating !== null && (
                  <>
                    <Star className="w-3.5 h-3.5 text-green fill-green shrink-0" />
                    <span>{charger.avg_rating.toFixed(1)}</span>
                    <span aria-hidden>·</span>
                  </>
                )}
                <span>
                  {charger.total_sessions} {charger.total_sessions === 1 ? 'session' : 'sessions'}
                </span>
                <span aria-hidden>·</span>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  isAvailable ? 'bg-green' : 'bg-muted',
                )} />
                <span className={cn(isAvailable ? 'text-green font-medium' : '')}>
                  {isAvailable ? 'Available now' : 'Temporarily unavailable'}
                </span>
              </div>
            </div>

            {/* Spec grid — connector and max power only */}
            <div className="bg-surface-card md:bg-transparent px-4 md:px-0 pt-5 pb-5 md:pb-6 mt-2 md:mt-0 border-b border-border md:border-0">
              <EyebrowLabel className="mb-3">Specifications</EyebrowLabel>
              <div className="grid grid-cols-2 gap-2">
                <SpecTile label="Connector" value={connectorsLabel} />
                <SpecTile label="Max power" value={powerLabel} />
              </div>
            </div>

            {/* Host */}
            {lender && (
              <div className="bg-surface-card md:bg-transparent px-4 md:px-0 pt-5 pb-5 md:pb-6 mt-2 md:mt-0 border-b border-border md:border-0">
                <EyebrowLabel className="mb-3">Host</EyebrowLabel>
                <div className="flex items-center gap-3">
                  <Avatar
                    avatarUrl={lender.avatar_url ?? null}
                    name={lender.name ?? null}
                    size="md"
                  />
                  <div>
                    <p className="text-base font-medium text-ink">{lender.name ?? 'Host'}</p>
                    {lender.avg_rating !== null && (
                      <p className="flex items-center gap-1 text-sm text-muted">
                        <Star className="w-3 h-3 text-green fill-green" />
                        <span>{lender.avg_rating.toFixed(1)} host rating</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Location — single prose sentence, exact address revealed after confirmed booking */}
            <div className="bg-surface-0 md:bg-transparent px-4 md:px-0 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6 mt-2 md:mt-0">
              <EyebrowLabel className="mb-3">Location</EyebrowLabel>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                {hasConfirmedBooking ? (
                  <p className="text-sm text-ink">{charger.address}</p>
                ) : (
                  <p className="text-sm text-muted">
                    Exact address is shared after your booking is confirmed.
                  </p>
                )}
              </div>

              {hasConfirmedBooking && charger.instructions && (
                <div className="mt-5 rounded-token border border-border p-4">
                  <EyebrowLabel className="mb-2">Access instructions</EyebrowLabel>
                  <p className="text-sm text-ink leading-relaxed">{charger.instructions}</p>
                </div>
              )}
            </div>

          </div>

          {/* Sticky booking card — desktop only. Rate is the only place price appears. */}
          <aside className="w-80 shrink-0 sticky top-6 hidden md:block">
            <Card>
              <p className="text-2xl font-semibold text-green font-mono">
                ₹{charger.price_per_kwh}
                <span className="text-sm font-medium text-muted">/kWh</span>
              </p>
              <p className="text-xs text-muted mt-0.5 mb-5">Rate per unit</p>
              <Link href={`/bookings/new?charger=${charger.id}`} className="block">
                <Button variant="primary" className="w-full">Book now</Button>
              </Link>
            </Card>
          </aside>

        </div>
      </div>

      {/* Pinned mobile action bar — the only place rate appears on mobile */}
      <div className="md:hidden">
        <ActionBar>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted">Rate</p>
              <p className="text-lg font-semibold text-green font-mono">
                ₹{charger.price_per_kwh}
                <span className="text-sm font-normal text-muted">/kWh</span>
              </p>
            </div>
            <Link href={`/bookings/new?charger=${charger.id}`} className="flex-1">
              <Button variant="primary" className="w-full">Book now</Button>
            </Link>
          </div>
        </ActionBar>
      </div>

    </div>
  );
}
