import { get } from '@vercel/edge-config';

// Safe defaults used when EDGE_CONFIG is absent (local dev, CI).
// emergency_lockdown defaults false — never lock down by accident.
// Feature flags default to the "feature exists and is on" state,
// except features that are not yet built (saved_chargers, vehicles).
const DEFAULTS = {
  emergency_lockdown: false,
  route_planning_enabled: true,
  ratings_enabled: true,
  saved_chargers_enabled: false,
  vehicles_enabled: false,
} as const;

async function safeGet<K extends keyof typeof DEFAULTS>(key: K): Promise<typeof DEFAULTS[K]> {
  if (!process.env.EDGE_CONFIG) return DEFAULTS[key];
  try {
    const val = await get<typeof DEFAULTS[K]>(key);
    return val ?? DEFAULTS[key];
  } catch {
    return DEFAULTS[key];
  }
}

export async function isEmergencyLockdown(): Promise<boolean> {
  return safeGet('emergency_lockdown');
}

export interface FeatureFlags {
  route_planning_enabled: boolean;
  ratings_enabled: boolean;
  saved_chargers_enabled: boolean;
  vehicles_enabled: boolean;
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  if (!process.env.EDGE_CONFIG) {
    return {
      route_planning_enabled: DEFAULTS.route_planning_enabled,
      ratings_enabled: DEFAULTS.ratings_enabled,
      saved_chargers_enabled: DEFAULTS.saved_chargers_enabled,
      vehicles_enabled: DEFAULTS.vehicles_enabled,
    };
  }
  try {
    const [rp, rat, sc, veh] = await Promise.all([
      safeGet('route_planning_enabled'),
      safeGet('ratings_enabled'),
      safeGet('saved_chargers_enabled'),
      safeGet('vehicles_enabled'),
    ]);
    return {
      route_planning_enabled: rp,
      ratings_enabled: rat,
      saved_chargers_enabled: sc,
      vehicles_enabled: veh,
    };
  } catch {
    return {
      route_planning_enabled: DEFAULTS.route_planning_enabled,
      ratings_enabled: DEFAULTS.ratings_enabled,
      saved_chargers_enabled: DEFAULTS.saved_chargers_enabled,
      vehicles_enabled: DEFAULTS.vehicles_enabled,
    };
  }
}

/**
 * Write a single key to Edge Config via the Vercel REST API.
 * Requires EDGE_CONFIG_ID and VERCEL_ACCESS_TOKEN environment variables.
 * Only callable from server-side contexts (API routes, server components).
 */
export async function updateEdgeConfigItem(key: string, value: unknown): Promise<void> {
  const id = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_ACCESS_TOKEN;
  if (!id || !token) {
    throw new Error(
      'EDGE_CONFIG_ID and VERCEL_ACCESS_TOKEN must be set to modify Edge Config. ' +
      'See docs/SETUP.md § Edge Config.',
    );
  }
  const res = await fetch(`https://api.vercel.com/v1/edge-config/${id}/items`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: [{ operation: 'upsert', key, value }] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Edge Config update failed (${res.status}): ${text}`);
  }
}
