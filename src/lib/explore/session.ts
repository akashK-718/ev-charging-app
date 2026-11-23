import type { ExploreFilterState, FilterVehicle } from '../../types/explore';
import type { Coords } from '../maps/types';
import type { Database } from '../supabase/types';
import { MAX_PRICE } from './filters';
type ChargerRow = Database['public']['Tables']['chargers']['Row'];

export const DELHI_NCR: Coords = { lat: 28.6139, lng: 77.209 };
export const DEFAULT_RADIUS = 10000;
export const DEFAULT_BUFFER = 2500;
export { MAX_PRICE } from './filters';
// Legacy User-level key — never written again; purged on first load.
export const LEGACY_STORAGE_KEY = 'chargers_map_state_v2';

// Session-scoped storage keys (sessionStorage, cleared on signOut).
// No userId suffix needed — sessionStorage is per-tab and not shared across users.
export const SESSION_KEY_MODE        = 'kirin:explore:mode';
export const SESSION_KEY_NEAR_ME     = 'kirin:explore:near_me';
export const SESSION_KEY_ALONG_ROUTE = 'kirin:explore:along_route';
// Per-mode suggestion dismissal — each mode tracks independently.
export const SESSION_KEY_SUGGESTION_DISMISSED_NEAR_ME = 'kirin:explore:suggestion-dismissed:near_me';
export const SESSION_KEY_SUGGESTION_DISMISSED_ROUTE   = 'kirin:explore:suggestion-dismissed:along_route';

// ── Session state types ───────────────────────────────────────────────────────

export type SearchMode = 'near_me' | 'along_route';

// FilterVehicle is the vehicle shape used by both FilterSheet and this page.
export type Vehicle = FilterVehicle;

export const DEFAULT_FILTER_STATE: ExploreFilterState = {
  compatibility: { type: 'none' },
  availability:  'any',
  powerFilter:   'any',
  maxPrice:      MAX_PRICE,
};

export type RouteCharger = ChargerRow & { distance_from_route_m: number };

export type NearMeSession = {
  center: Coords;
  radius: number | 'all_india';
  viewMode: 'map' | 'list';
  centerType: 'gps' | 'manual' | 'default';
};

export type AlongRouteSession = {
  routeFrom: { coords: Coords; address: string } | null;
  routeFromAddress: string;
  routeTo: { coords: Coords; address: string } | null;
  routeToAddress: string;
  fromIsGps: boolean;
};

export function loadSession<T>(key: string, storage?: Pick<Storage, 'getItem'>): T | null {
  try {
    const raw = (storage ?? sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

export function saveSession(key: string, value: unknown, storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? sessionStorage).setItem(key, JSON.stringify(value)); } catch {}
}


/** Deep links win over session memory; disabled routing always resolves to near-me. */
export function resolveSearchMode(urlMode: unknown, savedMode: unknown, routeEnabled = true): SearchMode {
  const valid = (value: unknown): value is SearchMode => value === 'near_me' || value === 'along_route';
  const mode = valid(urlMode) ? urlMode : valid(savedMode) ? savedMode : 'near_me';
  return routeEnabled ? mode : 'near_me';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function isCoords(value: unknown): value is Coords {
  return isRecord(value) && typeof value.lat === 'number' && typeof value.lng === 'number'
    && Number.isFinite(value.lat) && Number.isFinite(value.lng)
    && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
}
export function readNearMeSession(storage?: Pick<Storage, 'getItem'>): NearMeSession | null {
  const value = loadSession<unknown>(SESSION_KEY_NEAR_ME, storage);
  if (!isRecord(value) || !isCoords(value.center)) return null;
  if (value.radius !== 'all_india' && !(typeof value.radius === 'number' && Number.isFinite(value.radius) && value.radius > 0)) return null;
  if (value.viewMode !== 'map' && value.viewMode !== 'list') return null;
  if (value.centerType !== 'gps' && value.centerType !== 'manual' && value.centerType !== 'default') return null;
  return value as NearMeSession;
}
export function readAlongRouteSession(storage?: Pick<Storage, 'getItem'>): AlongRouteSession | null {
  const value = loadSession<unknown>(SESSION_KEY_ALONG_ROUTE, storage);
  const endpoint = (v: unknown) => v === null || (isRecord(v) && isCoords(v.coords) && typeof v.address === 'string');
  if (!isRecord(value) || !endpoint(value.routeFrom) || !endpoint(value.routeTo)
    || typeof value.routeFromAddress !== 'string' || typeof value.routeToAddress !== 'string'
    || typeof value.fromIsGps !== 'boolean') return null;
  return value as AlongRouteSession;
}
