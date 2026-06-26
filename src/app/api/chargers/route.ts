import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_SEARCH_RADIUS_METERS } from '@/lib/constants';

const VALID_CHARGER_TYPES = ['AC_3.3kW', 'AC_7kW', 'AC_22kW', 'DC_fast'] as const;
const VALID_CONNECTOR_TYPES = ['Type2', 'BharatAC', 'CCS2', 'CHAdeMO', 'Type1'] as const;

type ChargerType = (typeof VALID_CHARGER_TYPES)[number];
type ConnectorType = (typeof VALID_CONNECTOR_TYPES)[number];

/**
 * GET /api/chargers
 *
 * Query params (optional):
 *   - lat, lng: search center
 *   - radius: search radius in meters (default 5000)
 *   - connector: connector type filter
 *
 * Returns: list of chargers, optionally filtered + sorted by distance.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius =
    Number(searchParams.get('radius')) || DEFAULT_SEARCH_RADIUS_METERS;
  const connector = searchParams.get('connector');

  const supabase = createClient();

  let query = supabase
    .from('chargers')
    .select('*')
    .eq('status', 'active');

  if (connector) {
    query = query.contains('connector_types', [connector]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch chargers', detail: error.message },
      { status: 500 }
    );
  }

  // TODO: When PostGIS is set up, swap for a proper ST_DWithin query sorted by ST_Distance.
  void lat; void lng; void radius;

  return NextResponse.json({ chargers: data });
}

/**
 * POST /api/chargers
 *
 * Auth required. User must have role 'lender' or 'both'.
 * Inserts charger + availability slots atomically via the
 * create_charger_with_slots Postgres function (migration 004).
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Role check
  // Supabase v2's column-narrowing inference doesn't propagate the role union
  // through .single() — cast the result explicitly.
  const { data: profileRaw } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  const profile = profileRaw as { role: string } | null;

  if (!profile || !['lender', 'both'].includes(profile.role)) {
    return NextResponse.json(
      { error: 'Only lenders can list chargers' },
      { status: 403 },
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // Field validation
  const errors: string[] = [];

  if (typeof b.title !== 'string' || b.title.trim().length < 5 || b.title.trim().length > 120) {
    errors.push('title must be 5–120 characters');
  }

  if (!VALID_CHARGER_TYPES.includes(b.chargerType as ChargerType)) {
    errors.push('chargerType is invalid');
  }

  if (
    !Array.isArray(b.connectorTypes) ||
    b.connectorTypes.length === 0 ||
    !(b.connectorTypes as unknown[]).every(c => VALID_CONNECTOR_TYPES.includes(c as ConnectorType))
  ) {
    errors.push('connectorTypes must be a non-empty array of valid connector types');
  }

  const price = typeof b.pricePerKwh === 'number' ? b.pricePerKwh : NaN;
  if (isNaN(price) || price < 6 || price > 50) {
    errors.push('pricePerKwh must be between 6 and 50');
  }

  if (typeof b.address !== 'string' || b.address.trim().length < 5) {
    errors.push('address must be at least 5 characters');
  }

  const lat = typeof b.latitude === 'number' ? b.latitude : NaN;
  if (isNaN(lat) || lat < 6 || lat > 37) {
    errors.push('latitude must be within India (6–37)');
  }

  const lng = typeof b.longitude === 'number' ? b.longitude : NaN;
  if (isNaN(lng) || lng < 68 || lng > 97) {
    errors.push('longitude must be within India (68–97)');
  }

  if (
    !Array.isArray(b.photos) ||
    b.photos.length === 0 ||
    b.photos.length > 5 ||
    !(b.photos as unknown[]).every(p => typeof p === 'string')
  ) {
    errors.push('photos must be 1–5 Cloudinary URLs');
  }

  if (typeof b.instructions !== 'string' || b.instructions.trim().length < 10 || b.instructions.trim().length > 500) {
    errors.push('instructions must be 10–500 characters');
  }

  if (!Array.isArray(b.availability) || b.availability.length === 0) {
    errors.push('availability must have at least one slot');
  } else {
    for (const slot of b.availability as unknown[]) {
      if (
        typeof slot !== 'object' || slot === null ||
        !Array.isArray((slot as Record<string, unknown>).daysOfWeek) ||
        !(slot as Record<string, unknown>).daysOfWeek ||
        typeof (slot as Record<string, unknown>).startTime !== 'string' ||
        typeof (slot as Record<string, unknown>).endTime !== 'string'
      ) {
        errors.push('each availability slot must have daysOfWeek[], startTime, endTime');
        break;
      }
      const s = slot as { daysOfWeek: number[]; startTime: string; endTime: string };
      if (s.startTime >= s.endTime) {
        errors.push(`availability slot: endTime must be after startTime (got ${s.startTime}–${s.endTime})`);
        break;
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: errors[0], code: 'VALIDATION_ERROR', details: errors },
      { status: 400 },
    );
  }

  // Safe to cast after validation
  const validatedTitle = (b.title as string).trim();
  const validatedAddress = (b.address as string).trim();
  const validatedInstructions = (b.instructions as string).trim();
  const slots = (b.availability as Array<{ daysOfWeek: number[]; startTime: string; endTime: string }>)
    .map(s => ({ days_of_week: s.daysOfWeek, start_time: s.startTime, end_time: s.endTime }));

  const rpcArgs: Record<string, unknown> = {
    p_lender_id:       user.id,
    p_title:           validatedTitle,
    p_charger_type:    b.chargerType as string,
    p_connector_types: b.connectorTypes as string[],
    p_price_per_kwh:   price,
    p_address:         validatedAddress,
    p_latitude:        lat,
    p_longitude:       lng,
    p_photos:          b.photos as string[],
    p_instructions:    validatedInstructions,
    p_slots:           JSON.stringify(slots),
  };

  // Supabase v2 rpc() type inference resolves Functions as never when
  // Database['public']['Functions'] doesn't satisfy the internal GenericSchema
  // constraint in this version of @supabase/supabase-js. Cast through unknown as
  // the TS error message instructs to bypass the overlap check.
  const rpcCall = (supabase.rpc as unknown) as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: string | null; error: { message: string } | null }>;

  const { data: chargerId, error: rpcError } = await rpcCall(
    'create_charger_with_slots',
    rpcArgs,
  );

  if (rpcError) {
    console.error('[POST /api/chargers] rpc error', rpcError);
    return NextResponse.json(
      { error: "Couldn't save charger, please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { id: chargerId } }, { status: 201 });
}
