import { PIN_PATTERN } from './validation';

export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function usernameEmail(username: string): string {
  return `${username}@username.auth.local`;
}

export type PinField = 'username' | 'pin' | 'phone';

export function validateUsername(username: string): string | undefined {
  const value = normalizeUsername(username);
  if (!value) return 'Enter your username.';
  if (!USERNAME_PATTERN.test(value)) {
    return 'Use 3–30 letters, numbers, or underscores, starting with a letter.';
  }
}

export function validatePin(pin: string): string | undefined {
  if (!pin) return 'Enter your PIN.';
  if (!PIN_PATTERN.test(pin)) return 'Enter a 4-digit PIN.';
}

export type PinSession = {
  onboarded: boolean;
  isAdmin: boolean;
  session: { access_token: string; refresh_token: string };
};
