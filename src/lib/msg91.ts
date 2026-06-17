/**
 * MSG91 OTP integration.
 *
 * Sends and verifies one-time passwords via SMS.
 * Server-side use only.
 */

const MSG91_BASE = 'https://control.msg91.com/api/v5';

interface SendOtpResponse {
  type: 'success' | 'error';
  message: string;
  request_id?: string;
}

/**
 * Send an OTP to a phone number.
 * Phone should be in E.164 format without '+': "919876543210"
 */
export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  // Dev bypass: log OTP to console when MSG91 is not configured
  if (!process.env.MSG91_AUTH_KEY) {
    console.log(`[DEV] OTP for ${phone}: 000000`);
    return { type: 'success', message: 'Dev mode — use 000000', request_id: 'dev' };
  }

  const url = new URL(`${MSG91_BASE}/otp`);
  url.searchParams.set('template_id', process.env.MSG91_TEMPLATE_ID!);
  url.searchParams.set('mobile', phone);
  url.searchParams.set('authkey', process.env.MSG91_AUTH_KEY!);

  const res = await fetch(url, { method: 'POST' });
  return res.json();
}

/**
 * Verify the OTP a user entered.
 */
export async function verifyOtp(
  phone: string,
  otp: string
): Promise<{ verified: boolean; message: string }> {
  // Dev bypass: OTP "000000" always succeeds when MSG91 is not configured
  if (!process.env.MSG91_AUTH_KEY) {
    return { verified: otp === '000000', message: otp === '000000' ? 'Dev mode verified' : 'Wrong OTP' };
  }

  const url = new URL(`${MSG91_BASE}/otp/verify`);
  url.searchParams.set('mobile', phone);
  url.searchParams.set('otp', otp);

  const res = await fetch(url, {
    method: 'POST',
    headers: { authkey: process.env.MSG91_AUTH_KEY! }
  });
  const data = await res.json();
  return {
    verified: data.type === 'success',
    message: data.message
  };
}
