export type HistoryItem = {
  id: string;
  kind: 'charging' | 'hosting';
  roleInSession: 'driver' | 'host';
  bookingId: string;
  chargerId: string;
  chargerTitle: string;
  chargerPhoto: string | null;
  chargerLat: number | null;
  chargerLng: number | null;
  counterpartyName: string | null;
  displayAmountPaise: number | null;
  hasRated: boolean;
  status: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  lifecycleReason: string | null;
};

export type UpdateItem = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  read: boolean;
};

export type TabType    = 'sessions' | 'updates';
export type FilterType = 'all' | 'upcoming' | 'completed' | 'cancelled';
export type SortDir    = 'newest' | 'oldest';


export type ActivityKind = 'booking' | 'session' | 'payment' | 'payout' | 'host' | 'notice';
