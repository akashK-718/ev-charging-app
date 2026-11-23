export type Availability = 'any' | 'now' | 'next_2h';
export type PowerFilter  = 'any' | string;

/**
 * Compatibility is a single mutually-exclusive dimension with three states:
 * - none        → no compatibility filter active ("Any vehicle")
 * - vehicle     → filter by the connector types of a specific saved vehicle
 * - manual      → user has explicitly picked individual connector types
 *
 * vehicle and manual are never both active at the same time. Selecting a vehicle
 * clears any manual selection; tapping a connector chip while vehicle is active
 * switches to manual (starting from scratch, not from the vehicle's connectors).
 */
export type CompatibilityState =
  | { type: 'none' }
  | { type: 'vehicle'; vehicleId: string; connectorTypes: string[] }
  | { type: 'manual'; connectors: Set<string> };

export interface FilterVehicle {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  connector_types: string[];
  is_default: boolean;
}

export type ExploreFilterState = {
  compatibility: CompatibilityState;
  availability: Availability;
  powerFilter: PowerFilter;
  maxPrice: number;
};
