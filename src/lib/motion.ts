export const DURATION = {
  fast: 'var(--dur-fast)',
  normal: 'var(--dur-normal)',
} as const;

export const EASING = {
  out: 'var(--ease-out)',
} as const;

export const TRANSITION = {
  fast: `all ${DURATION.fast} ${EASING.out}`,
  normal: `all ${DURATION.normal} ${EASING.out}`,
} as const;
