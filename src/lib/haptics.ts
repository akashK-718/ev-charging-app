// Android-only (navigator.vibrate is absent on iOS Safari by platform design).
// Visual feedback (tap-light / tap-medium CSS classes) must always carry the full
// message on its own — haptics are a bonus layer, never load-bearing.
export type HapticTier = 'light' | 'medium' | 'heavy' | 'error';

const PATTERN: Record<HapticTier, number | number[]> = {
  light:  10,
  medium: 25,
  heavy:  40,
  error:  [40, 30, 40],
};

export function haptic(tier: HapticTier = 'light'): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(PATTERN[tier]);
  }
}
