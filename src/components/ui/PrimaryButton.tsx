'use client';

import { Button } from '@/components/ui/Button';
import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<typeof Button>;

/**
 * Canonical primary CTA for the app.
 *
 * Always renders as `variant="primary"` (filled green, glow shadow, correct
 * disabled opacity). Every primary action button must use this; a screen
 * implementing its own one-off primary styling is a bug — this bug class has
 * already recurred in the charger wizard, booking, hosting intro, KYC, and
 * session-controls flows before this consolidation.
 *
 * Pass `loading` for spinner state, `size` for sm/md/lg, `w-full` via
 * `className` to stretch to container width. Do not pass `variant` — it is
 * always "primary".
 */
export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="primary" {...props} />;
}
