import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { VehiclesClient } from './VehiclesClient';
import type { Vehicle } from './VehiclesClient';

export default async function VehiclesPage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/auth');

  const adminSupabase = createAdminClient();
  const { data: vehicles } = await adminSupabase
    .from('vehicles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  return (
    <div className="max-w-lg mx-auto">
      <VehiclesClient initialVehicles={(vehicles ?? []) as Vehicle[]} />
    </div>
  );
}
