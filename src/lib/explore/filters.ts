import type { CompatibilityState, ExploreFilterState } from '../../types/explore';
import type { Database } from '../supabase/types';

type FilterableCharger = Pick<Database['public']['Tables']['chargers']['Row'],
  'connector_types' | 'price_per_kwh' | 'status' | 'charger_type'>;

export const MAX_PRICE = 50;

export function resolveConnectors(compatibility: CompatibilityState): Set<string> | null {
  if (compatibility.type === 'vehicle') return new Set(compatibility.connectorTypes);
  if (compatibility.type === 'manual' && compatibility.connectors.size > 0) return compatibility.connectors;
  return null;
}

/** Retains input order and extra fields such as distance_from_route_m. */
export function filterChargers<T extends FilterableCharger>(chargers: T[], filters: ExploreFilterState): T[] {
  const connectors = resolveConnectors(filters.compatibility);
  return chargers.filter(charger => {
    if (connectors && !charger.connector_types.some(type => connectors.has(type))) return false;
    if (filters.maxPrice < MAX_PRICE && Number(charger.price_per_kwh) > filters.maxPrice) return false;
    // Preserve existing behavior: both availability choices currently mean active.
    if (filters.availability !== 'any' && charger.status !== 'active') return false;
    if (filters.powerFilter !== 'any' && charger.charger_type !== filters.powerFilter) return false;
    return true;
  });
}

export function countActiveFilters(filters: ExploreFilterState): number {
  return Number(filters.compatibility.type !== 'none') + Number(filters.maxPrice < MAX_PRICE)
    + Number(filters.availability !== 'any') + Number(filters.powerFilter !== 'any');
}
