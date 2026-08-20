import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ReviewsBody, type WrittenCard } from '@/components/profile/ReviewsBody';

export default async function ReviewsPage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/auth');

  const admin = createAdminClient();

  const { data: rawWritten } = await admin
    .from('reviews')
    .select('id, booking_id, charger_id, reviewee_id, review_type, rating, review_text, created_at')
    .eq('reviewer_id', user.id)
    .order('created_at', { ascending: false });

  const written = (rawWritten ?? []) as Array<{
    id: string; booking_id: string; charger_id: string; reviewee_id: string;
    review_type: string; rating: number; review_text: string | null; created_at: string;
  }>;

  const allBookingIds = [...new Set(written.map(r => r.booking_id))];
  const allChargerIds = [...new Set(written.map(r => r.charger_id))];

  const [bookingsRes, chargersRes] = await Promise.all([
    allBookingIds.length
      ? admin.from('bookings').select('id, scheduled_start').in('id', allBookingIds)
      : Promise.resolve({ data: [] as Array<{ id: string; scheduled_start: string }> }),
    allChargerIds.length
      ? admin.from('chargers').select('id, title').in('id', allChargerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
  ]);

  const bookingMap = new Map(((bookingsRes.data ?? []) as Array<{ id: string; scheduled_start: string }>).map(b => [b.id, b.scheduled_start]));
  const chargerMap = new Map(((chargersRes.data ?? []) as Array<{ id: string; title: string }>).map(c => [c.id, c.title]));

  // Group by booking_id — drivers submit charger + lender reviews together
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

  return (
    <main
      className="max-w-lg mx-auto pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-10"
    >
      <ReviewsBody written={[...bookingGroupMap.values()]} />
    </main>
  );
}
