import type { ConnectorType } from '@/lib/constants';

export type ChargerType = 'AC_3.3kW' | 'AC_7kW' | 'AC_22kW' | 'DC_fast';

export type ChargerStatus = 'active' | 'paused' | 'suspended';

export interface Charger {
  id: string;
  lenderId: string;
  title: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  pricePerKwh: number;
  address: string;
  latitude: number;
  longitude: number;
  photos: string[];
  status: ChargerStatus;
  avgRating: number | null;
  totalSessions: number;
}

/**
 * Used when displaying chargers in lists/maps — includes computed fields.
 */
export interface ChargerWithDistance extends Charger {
  distanceMeters: number;
  isAvailable: boolean;
}
