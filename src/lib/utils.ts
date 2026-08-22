import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines Tailwind class names, resolving conflicts.
 * Usage: cn('px-2', condition && 'bg-red-500', 'px-4') → 'bg-red-500 px-4'
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as Indian Rupees: 1500 → "₹1,500"
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Convert paise (smallest currency unit) to rupees.
 * Razorpay works in paise; we display rupees.
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Generate a short, human-readable confirmation code.
 * Example: "X-7K2Q"
 */
/**
 * Normalize a geocoding-derived address string.
 * Mapbox uses non-ASCII punctuation as component separators in place_name/text
 * for certain regions. Confirmed via byte-level API inspection (branch
 * diagnose/address-comma-raw-bytes): Indian road features use U+060C ARABIC
 * COMMA (،, bytes D8 8C). Replaces these — and any surrounding whitespace —
 * with a standard ASCII ", " so addresses render correctly everywhere.
 *
 * Characters covered:
 *   U+060C  ARABIC COMMA           (،)  — confirmed in Mapbox Indian geodata
 *   U+2E41  REVERSED COMMA         (⹁)  — guard against other regions
 *   U+3001  IDEOGRAPHIC COMMA      (、) — guard against East Asian geodata
 *   U+FE50  SMALL COMMA            (﹐) — guard against compatibility variants
 */
export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return '';
  return address.replace(/\s*[،⹁、﹐]\s*/g, ', ');
}

export function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
