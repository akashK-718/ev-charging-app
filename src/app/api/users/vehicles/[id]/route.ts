import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { CONNECTOR_TYPES } from '@/lib/constants';
import type { ConnectorType } from '@/lib/constants';
import type { Database } from '@/lib/supabase/types';

type VehicleUpdate = Database['public']['Tables']['vehicles']['Update'];

interface Params { id: string }

export async function PATCH(req: Request, { params }: { params: Params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Partial<VehicleUpdate & { connector_types: string[] }>;
  const adminSupabase = createAdminClient();

  const { data: existing } = await adminSupabase
    .from('vehicles')
    .select('id, user_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (body.connector_types !== undefined) {
    const cts = body.connector_types;
    if (!Array.isArray(cts) || cts.length === 0 || !cts.every(ct => CONNECTOR_TYPES.includes(ct as ConnectorType))) {
      return NextResponse.json({ error: 'Invalid connector types' }, { status: 400 });
    }
  }

  if (body.is_default === true) {
    await adminSupabase
      .from('vehicles')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .neq('id', params.id);
  }

  const updates: VehicleUpdate = {};
  if (body.make !== undefined) updates.make = body.make?.trim();
  if (body.model !== undefined) updates.model = body.model?.trim();
  if (body.nickname !== undefined) updates.nickname = body.nickname?.trim() || null;
  if (body.license_plate !== undefined) updates.license_plate = body.license_plate?.trim() || null;
  if (body.connector_types !== undefined) updates.connector_types = body.connector_types;
  if (body.battery_capacity_kwh !== undefined) updates.battery_capacity_kwh = body.battery_capacity_kwh;
  if (body.is_default !== undefined) updates.is_default = body.is_default;

  const { data, error } = await adminSupabase
    .from('vehicles')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vehicle: data });
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminSupabase = createAdminClient();

  const { data: existing } = await adminSupabase
    .from('vehicles')
    .select('id, user_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await adminSupabase
    .from('vehicles')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
