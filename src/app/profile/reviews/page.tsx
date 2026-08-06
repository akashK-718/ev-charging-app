import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ReviewsBody, type WrittenCard, type ReceivedCard } from '@/components/profile/ReviewsBody';

export default async function ReviewsPage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/auth');

  const admin = createAdminClient();

  const { data: profileData } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (profileData as { role: string } | null)?.role ?? 'driver';
  const isLender = role === 'lender';

  const [writtenRes, receivedRes] = await Promise.all([
    admin
      .from('reviews')
      .select('id, booking_id, charger_id, reviewee_id, review_type, rating, review_text, created_at')
      .eq('reviewer_id', user.id)
      .order('created_at', { ascending: false }),
    isLender
      ? admin
          .from('reviews')
          .select('id, booking_id, charger_id, reviewer_id, rating, created_at')
          .eq('reviewee_id', user.id)
          .eq('review_type', 'lender')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const written = (writtenRes.data ?? []) as Array<{
    id: string; booking_id: string; charger_id: string; reviewee_id: string;
    review_type: string; rating: number; review_text: string | null; created_at: string;
  }>;
  const received = ((receivedRes as { data: unknown }).data ?? []) as Array<{
    id: string; booking_id: string; charger_id: string; reviewer_id: string;
    rating: number; created_at: string;
  }>;

  const allBookingIds = [...new Set([...written.map(r => r.booking_id), ...received.map(r => r.booking_id)])];
  const allChargerIds = [...new Set([...written.map(r => r.charger_id), ...received.map(r => r.charger_id)])];
  const allUserIds    = [...new Set([...written.map(r => r.reviewee_id), ...received.map(r => r.reviewer_id)])];

  const [bookingsRes, chargersRes, usersRes] = await Promise.all([
    allBookingIds.length
      ? admin.from('bookings').select('id, scheduled_start').in('id', allBookingIds)
      : Promise.resolve({ data: [] as Array<{ id: string; scheduled_start: string }> }),
    allChargerIds.length
      ? admin.from('chargers').select('id, title').in('id', allChargerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    allUserIds.length
      ? admin.from('users').select('id, name').in('id', allUserIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);

  const bookingMap = new Map(((bookingsRes.data ?? []) as Array<{ id: string; scheduled_start: string }>).map(b => [b.id, b.scheduled_start]));
  const chargerMap = new Map(((chargersRes.data ?? []) as Array<{ id: string; title: string }>).map(c => [c.id, c.title]));
  const userMap    = new Map(((usersRes.data ?? []) as Array<{ id: string; name: string | null }>).map(u => [u.id, u.name]));

  // Group written reviews by booking_id (a driver submits charger + lender together)
  const bookingGroupMap = new Map<string, WrittenCard>();
  for (const r of written) {
    if (!bookingGroupMap.has(r.booking_id)) {
      bookingGroupMap.set(r.booking_id, {
        bookingId: r.booking_id,
        chargerTitle: chargerMap.get(r.charger_id) ?? 'Charger',
        scheduledStart: bookingMap.get(r.booking_id) ?? r.created_at,
        chargerRating: null,
        lenderRating: null,
        driverRating: null,
        reviewText: null,
        createdAt: r.created_at,
      });
    }
    const card = bookingGroupMap.get(r.booking_id)!;
    if (r.review_type === 'charger') { card.chargerRating = r.rating; card.reviewText = r.review_text ?? null; }
    else if (r.review_type === 'lender') card.lenderRating = r.rating;
    else if (r.review_type === 'driver') card.driverRating = r.rating;
  }

  const writtenCards: WrittenCard[] = [...bookingGroupMap.values()];

  const receivedCards: ReceivedCard[] = received.map(r => ({
    bookingId: r.booking_id,
    chargerTitle: chargerMap.get(r.charger_id) ?? 'Charger',
    scheduledStart: bookingMap.get(r.booking_id) ?? r.created_at,
    reviewerName: userMap.get(r.reviewer_id) ?? null,
    rating: r.rating,
    createdAt: r.created_at,
  }));

  return (
    <main
      className="max-w-lg mx-auto"
      style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <ReviewsBody written={writtenCards} received={receivedCards} isLender={isLender} />
    </main>
  );
}
