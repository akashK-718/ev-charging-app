// Android-only (navigator.vibrate is absent on iOS Safari by platform design).
// Visual feedback (tap-light / tap-medium / tap-strong CSS classes) must always
// carry the full message on its own — haptics are a bonus layer, never load-bearing.
export type HapticTier = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERN: Record<HapticTier, number | number[]> = {
  light:   10,
  medium:  25,
  heavy:   40,
  success: [10, 30, 10],   // double pulse — acknowledges a meaningful completion
  warning: [15, 10, 15],   // double-tap with short gap — "pay attention"
  error:   [40, 30, 40],   // heavy double thud — something went wrong
};

export function haptic(tier: HapticTier = 'light'): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(PATTERN[tier]);
  }
}
