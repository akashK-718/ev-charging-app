import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { CONNECTOR_TYPES } from '@/lib/constants';
import type { ConnectorType } from '@/lib/constants';

interface VehicleBody {
  make: string;
  model: string;
  nickname?: string;
  connector_types: string[];
  battery_capacity_kwh?: number | null;
  license_plate?: string;
  is_default?: boolean;
}

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const defaultOnly = searchParams.get('default_only') === 'true';

  const adminSupabase = createAdminClient();
  let query = adminSupabase
    .from('vehicles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (defaultOnly) query = query.eq('is_default', true).limit(1);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vehicles: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: VehicleBody;
  try {
    body = await req.json() as VehicleBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { make, model, nickname, connector_types, battery_capacity_kwh, license_plate } = body;

  if (!make?.trim() || !model?.trim()) {
    return NextResponse.json({ error: 'Make and model are required' }, { status: 400 });
  }
  if (!Array.isArray(connector_types) || connector_types.length === 0) {
    return NextResponse.json({ error: 'At least one connector type is required' }, { status: 400 });
  }
  if (!connector_types.every(ct => CONNECTOR_TYPES.includes(ct as ConnectorType))) {
    return NextResponse.json({ error: 'Invalid connector type' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { count } = await adminSupabase
    .from('vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const isFirst = (count ?? 0) === 0;
  const makeDefault = isFirst || !!body.is_default;

  if (makeDefault && !isFirst) {
    await adminSupabase
      .from('vehicles')
      .update({ is_default: false })
      .eq('user_id', user.id);
  }

  const { data, error } = await adminSupabase
    .from('vehicles')
    .insert({
      user_id: user.id,
      make: make.trim(),
      model: model.trim(),
      nickname: nickname?.trim() || null,
      connector_types,
      battery_capacity_kwh: battery_capacity_kwh ?? null,
      license_plate: license_plate?.trim() || null,
      is_default: makeDefault,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vehicle: data }, { status: 201 });
}
