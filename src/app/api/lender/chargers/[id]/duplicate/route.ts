import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const adminSupabase = createAdminClient();

  const { data: src } = await adminSupabase
    .from('chargers')
    .select('lender_id, title, charger_type, connector_types, price_per_kwh, address, latitude, longitude, photos, instructions')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (!src) return NextResponse.json({ error: 'Charger not found' }, { status: 404 });

  const s = src as {
    lender_id: string; title: string; charger_type: string; connector_types: string[];
    price_per_kwh: number; address: string; latitude: number; longitude: number;
    photos: string[]; instructions: string | null;
  };

  if (s.lender_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: copy, error: insertErr } = await adminSupabase
    .from('chargers')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      lender_id: user.id,
      title: `Copy of ${s.title}`,
      charger_type: s.charger_type as any,
      connector_types: s.connector_types as any,
      price_per_kwh: s.price_per_kwh,
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
      photos: s.photos ?? [],
      instructions: s.instructions,
      status: 'draft' as any,
    })
    .select('id')
    .single();

  if (insertErr || !copy) return NextResponse.json({ error: 'Failed to duplicate' }, { status: 500 });

  const newId = (copy as { id: string }).id;

  // Copy availability slots
  const { data: slots } = await adminSupabase
    .from('availability_slots')
    .select('day_of_week, start_time, end_time, is_active')
    .eq('charger_id', params.id);

  if (slots && slots.length > 0) {
    await adminSupabase.from('availability_slots').insert(
      slots.map((sl: { day_of_week: number[]; start_time: string; end_time: string; is_active: boolean }) => ({
        charger_id: newId,
        day_of_week: sl.day_of_week,
        start_time: sl.start_time,
        end_time: sl.end_time,
        is_active: sl.is_active,
      }))
    );
  }

  return NextResponse.json({ id: newId });
}
