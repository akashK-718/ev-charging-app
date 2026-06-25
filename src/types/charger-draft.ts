import type { ChargerType } from '@/types/charger';
import type { ConnectorType } from '@/lib/constants';

export interface NewChargerDraft {
  // Step 1
  chargerType?: ChargerType;
  connectorTypes?: ConnectorType[];
  // Step 2
  pricePerKwh?: number;
  // Step 3
  address?: string;
  latitude?: number;
  longitude?: number;
  // Step 4 — Cloudinary URLs, ordered (index 0 = cover photo)
  photos?: string[];
}
