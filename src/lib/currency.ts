export function formatINR(paise: number): string {
  const rupees = paise / 100;
  const cents = paise % 100;
  const fractionDigits = cents === 0 ? 0 : 2;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(rupees);
  return `₹${formatted}`;
}
