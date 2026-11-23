export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;
export const MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function usernameEmail(username: string): string {
  return `${username}@username.auth.local`;
}

export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

export type PasswordSession = {
  onboarded: boolean;
  isAdmin: boolean;
  session: { access_token: string; refresh_token: string };
};
