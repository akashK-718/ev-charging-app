import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { applyLocationOffset } from '@/lib/location/offset';

const VALID_CHARGER_TYPES = ['AC_3.3kW', 'AC_7kW', 'AC_22kW', 'DC_fast'] as const;
const VALID_CONNECTOR_TYPES = ['Type2', 'BharatAC', 'CCS2', 'CHAdeMO', 'Type1'] as const;

type ChargerType = (typeof VALID_CHARGER_TYPES)[number];
type ConnectorType = (typeof VALID_CONNECTOR_TYPES)[number];

async function getOwnerCheck(chargerId: string, userId: string) {
  const adminSupabase = createAdminClient();
  const { data: charger } = await adminSupabase
    .from('chargers')
    .select('id, lender_id, deleted_at')
    .eq('id', chargerId)
    .single();

  if (!charger) return { charger: null, isOwner: false };
  const c = charger as { id: string; lender_id: string; deleted_at: string | null };
  return { charger: c, isOwner: c.lender_id === userId };
}

/**
 * GET /api/chargers/[id] — public charger details, used by the booking form.
 *
 * Unauthenticated or no confirmed booking → offset coords, no address.
 * Has confirmed/in_progress booking for this charger → exact coords + address.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const adminSupabase = createAdminClient();
  const { data: charger, error } = await adminSupabase
    .from('chargers')
    .select('id, lender_id, title, charger_type, connector_types, price_per_kwh, address, latitude, longitude, status, deleted_at, photos, instructions')
    .eq('id', params.id)
    .single();

  if (error || !charger || charger.deleted_at) {
    return NextResponse.json({ error: 'Charger not found' }, { status: 404 });
  }

  // Reveal exact coords if the user is the charger's lender OR has a confirmed booking
  let revealExact = false;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const c = charger as typeof charger & { lender_id: string };
    if (c.lender_id === user.id) {
      revealExact = true;
    } else {
      const { data: booking } = await adminSupabase
        .from('bookings')
        .select('id')
        .eq('charger_id', params.id)
        .eq('driver_id', user.id)
        .in('status', ['confirmed', 'awaiting_driver_confirmation', 'in_progress', 'completed'])
        .maybeSingle();
      revealExact = !!booking;
    }
  }

  const { latitude, longitude, address, ...chargerRest } = charger as typeof charger & {
    latitude: number;
    longitude: number;
    address: string;
  };

  if (revealExact) {
    return NextResponse.json({
      data: { ...chargerRest, latitude, longitude, address, is_approximate: false },
    });
  }

  const offset = applyLocationOffset(latitude, longitude, params.id);
  return NextResponse.json({
    data: { ...chargerRest, latitude: offset.latitude, longitude: offset.longitude, address: null, is_approximate: true },
  });
}

/**
 * PATCH /api/chargers/[id] — update a charger (all fields optional).
 * Auth: must own charger.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { charger, isOwner } = await getOwnerCheck(params.id, user.id);
  if (!charger) return NextResponse.json({ error: 'Charger not found' }, { status: 404 });
  if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (charger.deleted_at) return NextResponse.json({ error: 'Charger has been deleted' }, { status: 410 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  const updates: Record<string, unknown> = {};

  if ('title' in b) {
    if (typeof b.title !== 'string' || b.title.trim().length < 5 || b.title.trim().length > 120) {
      errors.push('title must be 5–120 characters');
    } else {
      updates.title = b.title.trim();
    }
  }

  if ('chargerType' in b) {
    if (!VALID_CHARGER_TYPES.includes(b.chargerType as ChargerType)) {
      errors.push('chargerType is invalid');
    } else {
      updates.charger_type = b.chargerType;
    }
  }

  if ('connectorTypes' in b) {
    if (
      !Array.isArray(b.connectorTypes) ||
      b.connectorTypes.length === 0 ||
      !(b.connectorTypes as unknown[]).every(c => VALID_CONNECTOR_TYPES.includes(c as ConnectorType))
    ) {
      errors.push('connectorTypes must be a non-empty array of valid connector types');
    } else {
      updates.connector_types = b.connectorTypes;
    }
  }

  if ('pricePerKwh' in b) {
    const price = typeof b.pricePerKwh === 'number' ? b.pricePerKwh : NaN;
    if (isNaN(price) || price < 6 || price > 50) {
      errors.push('pricePerKwh must be between 6 and 50');
    } else {
      updates.price_per_kwh = price;
    }
  }

  if ('address' in b) {
    if (typeof b.address !== 'string' || b.address.trim().length < 5) {
      errors.push('address must be at least 5 characters');
    } else {
      updates.address = b.address.trim();
    }
  }

  if ('latitude' in b) {
    const lat = typeof b.latitude === 'number' ? b.latitude : NaN;
    if (isNaN(lat) || lat < 6 || lat > 37) {
      errors.push('latitude must be within India (6–37)');
    } else {
      updates.latitude = lat;
    }
  }

  if ('longitude' in b) {
    const lng = typeof b.longitude === 'number' ? b.longitude : NaN;
    if (isNaN(lng) || lng < 68 || lng > 97) {
      errors.push('longitude must be within India (68–97)');
    } else {
      updates.longitude = lng;
    }
  }

  if ('photos' in b) {
    if (
      !Array.isArray(b.photos) ||
      b.photos.length === 0 ||
      b.photos.length > 5 ||
      !(b.photos as unknown[]).every(p => typeof p === 'string')
    ) {
      errors.push('photos must be 1–5 Cloudinary URLs');
    } else {
      updates.photos = b.photos;
    }
  }

  if ('instructions' in b) {
    if (typeof b.instructions !== 'string' || b.instructions.trim().length < 10 || b.instructions.trim().length > 500) {
      errors.push('instructions must be 10–500 characters');
    } else {
      updates.instructions = b.instructions.trim();
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], details: errors }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const adminSupabase = createAdminClient();
  const { data: updated, error: updateError } = await adminSupabase
    .from('chargers')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq('id', params.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update charger' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, charger: updated });
}

/**
 * DELETE /api/chargers/[id] — soft delete a charger.
 * Auth: must own charger.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { charger, isOwner } = await getOwnerCheck(params.id, user.id);
  if (!charger) return NextResponse.json({ error: 'Charger not found' }, { status: 404 });
  if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminSupabase = createAdminClient();
  const { error: deleteError } = await adminSupabase
    .from('chargers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete charger' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
