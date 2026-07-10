import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Clock, MapPin, Star, Zap } from 'lucide-react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ImageCarousel } from '@/components/chargers/ImageCarousel';
import { DisplayTitle } from '@/components/ui/DisplayTitle';
import { EyebrowLabel } from '@/components/ui/EyebrowLabel';
import { SpecTile } from '@/components/ui/SpecTile';
import { InfoRow } from '@/components/ui/InfoRow';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { ActionBar } from '@/components/ui/ActionBar';
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

  const powerLabel = CHARGER_TYPE_LABEL[charger.charger_type] ?? charger.charger_type;
  const connectorsLabel = charger.connector_types.join(' · ');

  return (
    <div className="min-h-screen bg-surface-1">
      {/* Mobile hero — edge-to-edge */}
      <div className="md:hidden">
        <ImageCarousel
          photos={charger.photos ?? []}
          alt={charger.title}
          autoRotate
          useIntersectionObserver={false}
          className="w-full h-[200px]"
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

            {/* Title & rate */}
            <div className="bg-surface-0 md:bg-transparent px-4 md:px-0 pt-5 pb-5 md:pb-6 border-b border-border md:border-0">
              <DisplayTitle>{charger.title}</DisplayTitle>
              <p className="mt-2 text-xl font-medium text-volt-deep">
                ₹{charger.price_per_kwh}
                <span className="text-sm font-medium text-muted"> /kWh</span>
              </p>
              {charger.avg_rating !== null && (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
                  <Star className="w-3.5 h-3.5 text-volt-deep fill-volt-deep" />
                  <span>{charger.avg_rating.toFixed(1)}</span>
                  <span>·</span>
                  <span>{charger.total_sessions} sessions</span>
                </p>
              )}
            </div>

            {/* Specs */}
            <div className="bg-surface-0 md:bg-transparent px-4 md:px-0 pt-5 pb-5 md:pb-6 mt-2 md:mt-0 border-b border-border md:border-0">
              <EyebrowLabel className="mb-3">Specifications</EyebrowLabel>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SpecTile label="Connector" value={connectorsLabel} />
                <SpecTile label="Max power" value={powerLabel} />
                <SpecTile label="Rate" value={`₹${charger.price_per_kwh}/kWh`} />
                <SpecTile label="Sessions" value={String(charger.total_sessions)} />
              </div>
            </div>

            {/* Host */}
            {lender && (
              <div className="bg-surface-0 md:bg-transparent px-4 md:px-0 pt-5 pb-5 md:pb-6 mt-2 md:mt-0 border-b border-border md:border-0">
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
                        <Star className="w-3 h-3 text-volt-deep fill-volt-deep" />
                        <span>{lender.avg_rating.toFixed(1)} host rating</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Location & availability */}
            <div className="bg-surface-0 md:bg-transparent px-4 md:px-0 pt-5 pb-28 md:pb-6 mt-2 md:mt-0">
              <EyebrowLabel className="mb-1">Location & Availability</EyebrowLabel>
              <InfoRow
                icon={MapPin}
                label="Location"
                value={
                  hasConfirmedBooking
                    ? charger.address
                    : <span className="text-xs text-amber-600">Shown after booking confirmed</span>
                }
              />
              <InfoRow
                icon={Zap}
                label="Connectors"
                value={charger.connector_types.join(', ')}
              />
              <InfoRow
                icon={Clock}
                label="Availability"
                value={charger.status === 'active' ? 'Available now' : 'Temporarily unavailable'}
              />

              {hasConfirmedBooking && charger.instructions && (
                <div className="mt-5 rounded-token border border-border p-4">
                  <EyebrowLabel className="mb-2">Access instructions</EyebrowLabel>
                  <p className="text-sm text-ink leading-relaxed">{charger.instructions}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sticky booking card — desktop only */}
          <aside className="w-80 shrink-0 sticky top-6 hidden md:block">
            <Card>
              <p className="text-2xl font-medium text-volt-deep">
                ₹{charger.price_per_kwh}
                <span className="text-sm font-medium text-muted">/kWh</span>
              </p>
              {charger.avg_rating !== null ? (
                <p className="flex items-center gap-1.5 text-sm text-muted mt-1 mb-4">
                  <Star className="w-3.5 h-3.5 text-volt-deep fill-volt-deep" />
                  {charger.avg_rating.toFixed(1)} · {charger.total_sessions} sessions
                </p>
              ) : (
                <div className="mb-4" />
              )}
              <div className="space-y-2.5 pb-4 mb-4 border-b border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Power</span>
                  <span className="font-medium text-ink">{powerLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Connector</span>
                  <span className="font-medium text-ink">{connectorsLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Status</span>
                  <span className="font-medium text-ink">
                    {charger.status === 'active' ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>
              <Link href={`/bookings/new?charger=${charger.id}`} className="block">
                <Button variant="primary" className="w-full">Book now</Button>
              </Link>
            </Card>
          </aside>

        </div>
      </div>

      {/* Pinned mobile CTA */}
      <div className="md:hidden">
        <ActionBar>
          <div className="flex items-center gap-4">
            <p className="flex-1 text-lg font-medium text-ink">
              ₹{charger.price_per_kwh}
              <span className="text-sm font-medium text-muted"> /kWh</span>
            </p>
            <Link href={`/bookings/new?charger=${charger.id}`} className="flex-1">
              <Button variant="primary" className="w-full">Book now</Button>
            </Link>
          </div>
        </ActionBar>
      </div>
    </div>
  );
}
