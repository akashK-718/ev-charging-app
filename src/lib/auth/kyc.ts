export type UserRole = 'driver' | 'lender' | 'admin';

// Only lenders require identity verification — drivers are never subject to KYC.
// Centralized here so every KYC-gated UI checks the same rule.
export function requiresKyc(role: UserRole | string): boolean {
  return role === 'lender';
}
