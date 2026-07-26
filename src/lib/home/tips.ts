export type TipEligibility = 'always' | 'hosting' | 'saved_chargers';

export type Tip = {
  id: string;
  body: string;
  eligibility: TipEligibility;
};

export const TIPS: Tip[] = [
  {
    id: 'check-availability',
    eligibility: 'always',
    body: 'Check charger availability before starting your trip.',
  },
  {
    id: 'plan-longer-journeys',
    eligibility: 'always',
    body: 'Plan your charging stop before longer journeys.',
  },
  {
    id: 'vehicle-details',
    eligibility: 'always',
    body: 'Keep your vehicle details updated for smoother bookings.',
  },
  {
    // Gated: only shown when the Saved Chargers feature is live (saved_chargers_enabled flag).
    // Default false — feature is not yet built. See src/lib/edge-config.ts.
    id: 'save-chargers',
    eligibility: 'saved_chargers',
    body: 'Save chargers you use often for quicker access.',
  },
  {
    id: 'pause-charger',
    eligibility: 'hosting',
    body: 'You can pause your charger whenever it isn’t available.',
  },
  {
    id: 'update-availability',
    eligibility: 'hosting',
    body: 'Keeping your availability updated helps avoid cancellations.',
  },
  {
    id: 'clear-photos',
    eligibility: 'hosting',
    body: 'Clear charger photos help drivers know what to expect.',
  },
  {
    id: 'connector-details',
    eligibility: 'hosting',
    body: 'Keep your charger details and connector information up to date.',
  },
  {
    id: 'review-listing',
    eligibility: 'hosting',
    body: 'Review your listing after changing your charging setup.',
  },
  {
    id: 'session-start',
    eligibility: 'always',
    body: 'Only start a session when the vehicle is at the charger.',
  },
  {
    id: 'plan-trip',
    eligibility: 'always',
    body: 'Plan a trip to find charging stops along your route.',
  },
  {
    id: 'check-activity',
    eligibility: 'always',
    body: 'Check Activity for your charging and hosting history.',
  },
];

/**
 * Returns the subset of tips eligible for this user on this load.
 * Hosting-tagged tips are excluded for users who have never enabled hosting.
 * Saved-chargers tip is excluded unless the feature flag is on.
 */
export function getEligibleTips(isHosting: boolean, savedChargersEnabled: boolean): Tip[] {
  return TIPS.filter(t => {
    switch (t.eligibility) {
      case 'always':        return true;
      case 'hosting':       return isHosting;
      case 'saved_chargers': return savedChargersEnabled;
    }
  });
}
