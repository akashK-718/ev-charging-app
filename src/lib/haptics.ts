type HapticStyle = 'light' | 'medium' | 'heavy';

const PATTERN: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 30,
  heavy: [30, 20, 30],
};

export function haptic(style: HapticStyle = 'light'): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(PATTERN[style]);
  }
}
