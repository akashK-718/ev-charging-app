import type { ChargerType } from '@/types/charger';
import type { ConnectorType } from '@/lib/constants';

export interface AvailabilityDay {
  day_of_week: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
}

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
  // Step 5 — only enabled days stored
  availability?: AvailabilityDay[];
  // Step 6
  title?: string;
  instructions?: string;
}
