import type { ChargerType } from '@/types/charger';
import type { ConnectorType } from '@/lib/constants';

export interface NewChargerDraft {
  chargerType?: ChargerType;
  connectorTypes?: ConnectorType[];
  pricePerKwh?: number;
}
