'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Props {
  userId: string;
  isHosting: boolean;
}

/**
 * Invisible client component that holds Supabase realtime subscriptions for
 * the Home page. On any relevant change it calls router.refresh(), which
 * re-fetches the server component and re-evaluates the three-zone priority
 * rules with fresh data. Unsubscribes cleanly on unmount (route navigation).
 */
export function HomeRealtimeSync({ userId, isHosting }: Props) {
  const router        = useRouter();
  const pendingRef    = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    // Coalesce bursts of changes into a single refresh so rapid sequences
    // (e.g. booking created then immediately confirmed) don't pile up.
    function scheduleRefresh() {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setTimeout(() => {
        router.refresh();
        pendingRef.current = false;
      }, 400);
    }

    const channel = supabase
      .channel(`home:${userId}`)
      // Driver bookings — status changes affect Attention (starting-soon,
      // in-progress, awaiting-driver-confirmation) and Snapshot (upcoming).
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `driver_id=eq.${userId}` },
        scheduleRefresh,
      );

    if (isHosting) {
      // Lender bookings — incoming requests (pending) and status changes
      // affect the Attention pending-requests card and Snapshot workspace.
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `lender_id=eq.${userId}` },
        scheduleRefresh,
      );

      // Charger status changes — suspended chargers surface in Attention;
      // active charger count drives the Snapshot hosting-workspace card.
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chargers', filter: `lender_id=eq.${userId}` },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isHosting, router]);

  return null;
}
