import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

type ReviewRow = {
  review_type: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  locked_at: string | null;
};

type BookingRow = {
  id: string;
  charger_id: string;
  driver_id: string;
  lender_id: string;
  status: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();

  const { data: bookingData } = await admin
    .from('bookings')
    .select('id, charger_id, driver_id, lender_id, status')
    .eq('id', params.id)
    .single();

  if (!bookingData) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const booking = bookingData as BookingRow;

  if (booking.driver_id !== user.id && booking.lender_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: reviewsData } = await admin
    .from('reviews')
    .select('review_type, rating, review_text, created_at, locked_at')
    .eq('booking_id', params.id)
    .eq('reviewer_id', user.id);

  const reviews = (reviewsData ?? []) as ReviewRow[];
  const firstReview = reviews[0] ?? null;
  const canEdit = firstReview?.locked_at
    ? new Date(firstReview.locked_at).getTime() > Date.now()
    : false;

  const isDriver = user.id === booking.driver_id;
  let priorChargerReviewCount = 0;
  let lastChargerReviewAt: string | null = null;
  let priorDriverReviewCount = 0;
  let lastDriverReviewAt: string | null = null;

  if (isDriver) {
    const { data: prior } = await admin
      .from('reviews')
      .select('created_at')
      .eq('reviewer_id', user.id)
      .eq('charger_id', booking.charger_id)
      .eq('review_type', 'charger')
      .neq('booking_id', params.id)
      .order('created_at', { ascending: false });

    const priorRows = (prior ?? []) as Array<{ created_at: string }>;
    priorChargerReviewCount = priorRows.length;
    lastChargerReviewAt = priorRows[0]?.created_at ?? null;
  } else {
    const { data: prior } = await admin
      .from('reviews')
      .select('created_at')
      .eq('reviewer_id', user.id)
      .eq('reviewee_id', booking.driver_id)
      .eq('review_type', 'driver')
      .neq('booking_id', params.id)
      .order('created_at', { ascending: false });

    const priorRows = (prior ?? []) as Array<{ created_at: string }>;
    priorDriverReviewCount = priorRows.length;
    lastDriverReviewAt = priorRows[0]?.created_at ?? null;
  }

  return NextResponse.json({
    reviews: reviews.map(r => ({
      review_type: r.review_type,
      rating: r.rating,
      review_text: r.review_text,
    })),
    can_edit: canEdit,
    edit_expires_at: firstReview?.locked_at ?? null,
    repeat_context: {
      prior_charger_review_count: priorChargerReviewCount,
      last_charger_review_at: lastChargerReviewAt,
      prior_driver_review_count: priorDriverReviewCount,
      last_driver_review_at: lastDriverReviewAt,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();

  const { data: bookingData } = await admin
    .from('bookings')
    .select('id, charger_id, driver_id, lender_id, status')
    .eq('id', params.id)
    .single();

  if (!bookingData) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const booking = bookingData as BookingRow;

  if (booking.driver_id !== user.id && booking.lender_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (booking.status !== 'completed') {
    return NextResponse.json({ error: 'Booking must be completed to review' }, { status: 422 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Check existing review for edit window
  const { data: existingData } = await admin
    .from('reviews')
    .select('id, created_at, locked_at')
    .eq('booking_id', params.id)
    .eq('reviewer_id', user.id)
    .limit(1)
    .maybeSingle();

  const existing = existingData as { id: string; created_at: string; locked_at: string | null } | null;

  if (existing) {
    const editable = existing.locked_at
      ? new Date(existing.locked_at).getTime() > Date.now()
      : false;
    if (!editable) {
      return NextResponse.json({ error: 'Review period has expired' }, { status: 409 });
    }
  }

  const lockedAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const isDriver = user.id === booking.driver_id;

  if (isDriver) {
    const { charger_rating, lender_rating, review_text } = body;

    if (
      typeof charger_rating !== 'number' || charger_rating < 1 || charger_rating > 5 ||
      typeof lender_rating !== 'number' || lender_rating < 1 || lender_rating > 5
    ) {
      return NextResponse.json({ error: 'charger_rating and lender_rating must be 1–5' }, { status: 400 });
    }

    if (review_text !== undefined && review_text !== null) {
      if (typeof review_text !== 'string' || review_text.length > 200) {
        return NextResponse.json({ error: 'review_text must be at most 200 characters' }, { status: 400 });
      }
    }

    const text = typeof review_text === 'string' && review_text.trim() ? review_text.trim() : null;
    const usedLockedAt = existing?.locked_at ?? lockedAt;

    const { error: upsertError } = await admin
      .from('reviews')
      .upsert(
        [
          {
            booking_id: params.id,
            charger_id: booking.charger_id,
            reviewer_id: user.id,
            reviewee_id: booking.lender_id,
            review_type: 'charger',
            rating: charger_rating,
            review_text: text,
            updated_at: now,
            locked_at: usedLockedAt,
          },
          {
            booking_id: params.id,
            charger_id: booking.charger_id,
            reviewer_id: user.id,
            reviewee_id: booking.lender_id,
            review_type: 'lender',
            rating: lender_rating,
            review_text: null,
            updated_at: now,
            locked_at: usedLockedAt,
          },
        ],
        { onConflict: 'booking_id,reviewer_id,review_type' },
      );

    if (upsertError) {
      return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
    }
  } else {
    const { driver_rating } = body;

    if (typeof driver_rating !== 'number' || driver_rating < 1 || driver_rating > 5) {
      return NextResponse.json({ error: 'driver_rating must be 1–5' }, { status: 400 });
    }

    const usedLockedAt = existing?.locked_at ?? lockedAt;

    const { error: upsertError } = await admin
      .from('reviews')
      .upsert(
        [
          {
            booking_id: params.id,
            charger_id: booking.charger_id,
            reviewer_id: user.id,
            reviewee_id: booking.driver_id,
            review_type: 'driver',
            rating: driver_rating,
            review_text: null,
            updated_at: now,
            locked_at: usedLockedAt,
          },
        ],
        { onConflict: 'booking_id,reviewer_id,review_type' },
      );

    if (upsertError) {
      return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
