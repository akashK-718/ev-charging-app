export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';
  return phone.startsWith('+') ? phone : `+${phone}`;
}

export function formatPhoneForCall(phone: string): string {
  return `tel:${formatPhoneForDisplay(phone)}`;
}
