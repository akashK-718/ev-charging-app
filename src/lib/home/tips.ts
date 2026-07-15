export type Tip = {
  id: string;
  title?: string;
  body: string;
  link?: { label: string; href: string };
};

const TIPS: Tip[] = [
  {
    id: 'off-peak',
    body: 'Charging during off-peak hours is cheaper. Schedule your next session for late night.',
  },
  {
    id: 'pause-charger',
    body: 'You can pause your charger any time from the Hosting Workspace without losing your listing.',
  },
  {
    id: 'host-ratings',
    body: 'Hosts with an average rating above 4.5 receive more booking requests.',
  },
  {
    id: 'confirm-window',
    title: 'Respond quickly',
    body: 'Booking requests expire after 12 hours if not accepted. A fast response builds your host score.',
  },
  {
    id: 'session-history',
    body: 'Your session history in Activity shows kWh delivered and duration for every charge.',
  },
  {
    id: 'parking-instructions',
    body: 'Clear parking instructions in your listing reduce no-shows and driver confusion.',
  },
  {
    id: 'photo-tip',
    body: 'Listings with 5 or more photos receive significantly more booking requests.',
    link: { label: 'Update your listing', href: '/lender/chargers' },
  },
  {
    id: 'connector-types',
    body: 'Specifying the exact connector type reduces mismatched bookings and cancellations.',
  },
];

export function getActiveTip(seed: number): Tip {
  return TIPS[seed % TIPS.length];
}
