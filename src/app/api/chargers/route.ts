import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_SEARCH_RADIUS_METERS } from '@/lib/constants';

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

  // TODO: When PostGIS is set up, swap the above for a proper ST_DWithin query
  // sorted by ST_Distance. See supabase/migrations/002_add_postgis.sql.

  return NextResponse.json({ chargers: data });
}
