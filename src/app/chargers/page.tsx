import { createClient } from '@/lib/supabase/server';

/**
 * /chargers — list/map view of nearby chargers.
 * TODO (Milestone 2): integrate Leaflet map, geo query, filters.
 */
export default async function ChargersPage() {
  const supabase = createClient();
  // Placeholder: fetch all active chargers for now.
  // const { data } = await supabase.from('chargers').select('*').eq('status', 'active');

  return (
    <main className="min-h-screen px-6 py-12">
      <h1 className="font-display font-extrabold text-3xl">Chargers nearby</h1>
      <p className="mt-2 text-muted">
        Map and list view coming in Milestone 2.
      </p>
    </main>
  );
}
