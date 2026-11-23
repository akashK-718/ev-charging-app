import assert from 'node:assert/strict';
import test from 'node:test';
import { countActiveFilters, filterChargers, resolveConnectors } from '../src/lib/explore/filters';
import { DEFAULT_FILTER_STATE, loadSession, saveSession } from '../src/lib/explore/session';
import type { Database } from '../src/lib/supabase/types';
import type { ExploreFilterState } from '../src/types/explore';

type Charger = Pick<Database['public']['Tables']['chargers']['Row'], 'connector_types' | 'price_per_kwh' | 'status' | 'charger_type'> & { id: string; distance_from_route_m: number };
const chargers: Charger[] = [
  { id: 'a', connector_types: ['Type2'], price_per_kwh: 10, status: 'active', charger_type: 'AC_7kW', distance_from_route_m: 10 },
  { id: 'b', connector_types: ['CCS2'], price_per_kwh: 20, status: 'paused', charger_type: 'DC_fast', distance_from_route_m: 20 },
  { id: 'c', connector_types: ['Type2'], price_per_kwh: 60, status: 'active', charger_type: 'AC_22kW', distance_from_route_m: 30 },
];

test('unrestricted price sentinel retains expensive chargers and input objects', () => {
  assert.deepEqual(filterChargers(chargers, DEFAULT_FILTER_STATE), chargers);
  assert.equal(filterChargers(chargers, DEFAULT_FILTER_STATE)[0], chargers[0]);
  assert.equal(countActiveFilters(DEFAULT_FILTER_STATE), 0);
});

test('connector, price, availability and power filters combine and count by dimension', () => {
  const filters: ExploreFilterState = { compatibility: { type: 'manual', connectors: new Set(['Type2', 'CCS2']) }, maxPrice: 10, availability: 'now', powerFilter: 'AC_7kW' };
  assert.deepEqual(filterChargers(chargers, filters).map(c => c.id), ['a']);
  assert.equal(filterChargers(chargers, filters)[0].distance_from_route_m, 10);
  assert.equal(countActiveFilters(filters), 4);
  assert.deepEqual(filterChargers(chargers, { ...DEFAULT_FILTER_STATE, availability: 'next_2h' }).map(c => c.id), ['a', 'c']);
});

test('empty manual connectors disable filtering but an incompatible vehicle matches nothing', () => {
  assert.equal(resolveConnectors({ type: 'manual', connectors: new Set() }), null);
  assert.deepEqual(filterChargers(chargers, { ...DEFAULT_FILTER_STATE, compatibility: { type: 'vehicle', vehicleId: 'vehicle', connectorTypes: [] } }), []);
  assert.deepEqual(filterChargers(chargers, { ...DEFAULT_FILTER_STATE, compatibility: { type: 'vehicle', vehicleId: 'vehicle', connectorTypes: ['CCS2'] } }).map(c => c.id), ['b']);
});

test('session persistence round trips state and tolerates invalid JSON and unavailable storage', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const state = { radius: 'all_india', center: { lat: 28, lng: 77 }, viewMode: 'list' };
  saveSession('near', state, storage);
  assert.deepEqual(loadSession('near', storage), state);
  assert.equal(loadSession('missing', storage), null);
  values.set('bad', '{');
  assert.equal(loadSession('bad', storage), null);
  assert.equal(loadSession('blocked', { getItem() { throw new Error('denied'); } }), null);
  assert.doesNotThrow(() => saveSession('blocked', state, { setItem() { throw new Error('quota'); } }));
});
