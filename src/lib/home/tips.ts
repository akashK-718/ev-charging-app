export type TipContext = 'all' | 'hosting';

export type Tip = {
  id: string;
  title?: string;
  body: string;
  link?: { label: string; href: string };
  context: TipContext;
};

const TIPS: Tip[] = [
  {
    id: 'off-peak',
    context: 'all',
    body: 'Charging during off-peak hours is cheaper. Schedule your next session for late night.',
  },
  {
    id: 'session-history',
    context: 'all',
    body: 'Your session history in Activity shows kWh delivered and duration for every charge.',
  },
  {
    id: 'pause-charger',
    context: 'hosting',
    body: 'You can pause your charger any time from Manage Hosting without losing your listing.',
  },
  {
    id: 'host-ratings',
    context: 'hosting',
    body: 'Hosts with an average rating above 4.5 receive more booking requests.',
  },
  {
    id: 'confirm-window',
    context: 'hosting',
    title: 'Respond quickly',
    body: 'Booking requests expire after 12 hours if not accepted. A fast response builds your host score.',
  },
  {
    id: 'parking-instructions',
    context: 'hosting',
    body: 'Clear parking instructions in your listing reduce no-shows and driver confusion.',
  },
  {
    id: 'photo-tip',
    context: 'hosting',
    body: 'Listings with 5 or more photos receive significantly more booking requests.',
    link: { label: 'Update your listing', href: '/lender/chargers' },
  },
  {
    id: 'connector-types',
    context: 'hosting',
    body: 'Specifying the exact connector type reduces mismatched bookings and cancellations.',
  },
];

export function getActiveTip(seed: number, isHosting: boolean): Tip | null {
  const eligible = TIPS.filter(t => t.context === 'all' || isHosting);
  if (eligible.length === 0) return null;
  return eligible[seed % eligible.length];
}
