export type UserRole = 'driver' | 'lender' | 'both' | 'admin';

// Drivers never go through identity verification — only lenders (and the
// lender side of "both") are subject to KYC. Centralized here so every
// KYC-gated UI checks the same rule.
export function requiresKyc(role: UserRole | string): boolean {
  return role === 'lender' || role === 'both';
}
