export type SavedMethod = {
  id: string;
  method: 'card' | 'upi';
  // Card fields
  cardNetwork?: string;
  cardLast4?: string;
  cardExpiry?: string;
  cardIssuer?: string;
  // UPI fields
  upiVpa?: string;
  // Razorpay's own display label (may not always be present)
  billingLabel?: string;
};
