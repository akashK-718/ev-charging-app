/**
 * Shared PDF currency formatter — used by both the driver Payment Receipt
 * and the Host Earnings Statement PDF routes. All ₹ amounts in PDFs must
 * go through this function so formatting can't drift between documents.
 *
 * Takes rupees (not paise). Always two decimal places, Indian numbering.
 */
export function formatCurrency(rupees: number): string {
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
