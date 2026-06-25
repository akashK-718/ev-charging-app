import { createClient } from '@/lib/supabase/server';
import { ChargerListView } from '@/components/chargers/ChargerListView';

export default async function ChargersPage() {
  const supabase = createClient();
  const { data: chargers, error } = await supabase
    .from('chargers')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-ink">Find a charger</h1>
        <p className="text-sm text-muted mt-1">
          {error
            ? 'Could not load chargers right now.'
            : `${chargers?.length ?? 0} charger${chargers?.length === 1 ? '' : 's'} available`}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-500">Something went wrong. Please try again later.</p>
      ) : (
        <ChargerListView chargers={chargers ?? []} />
      )}
    </main>
  );
}
