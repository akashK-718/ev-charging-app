export const MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const PIN_PATTERN = /^\d{4}$/;
export const CODE_LENGTH = 6;
export const AUTH_MESSAGES = {
  invalidRequest: 'Invalid request. Please try again.',
  invalidCode: 'The code you entered is incorrect. Try again.',
  expiredCode: 'This code has expired. Request a new code.',
  sendCode: 'Could not send the verification code. Please try again.',
  signIn: 'Could not sign in. Please try again.',
  register: 'Could not create your account. Please try again.',
  saveName: 'Could not save your name. Please try again.',
  session: 'Could not start your session. Please try again.',
  rateLimit: 'Too many attempts. Please try again later.',
} as const;

export function validateMobile(phone: string): string | undefined {
  if (!phone.trim()) return 'Enter your phone number.';
  if (!MOBILE_PATTERN.test(phone.trim())) return 'Enter a valid 10-digit Indian mobile number.';
}

export function validateName(name: unknown): string | undefined {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value) return 'Enter your name.';
  if (value.length < 2) return 'Use at least 2 characters for your name.';
  if (value.length > 50) return 'Use 50 characters or fewer for your name.';
  if (!/^[\p{L}\s]+$/u.test(value)) return 'Use only letters and spaces for your name.';
}
